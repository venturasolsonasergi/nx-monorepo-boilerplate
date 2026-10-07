import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types';
import { AppModule } from '@app/api/app.module';
import { configureApp } from '@app/api/configure-app';
import { AuthPrismaService } from '@app/auth/infrastructure/prisma/prisma.service';
import { VerificationThrottlePrismaRepository } from '@app/auth/infrastructure/verification-throttle.repository.prisma';
import { VerificationRateLimitService } from '@app/auth/application/verification-rate-limit.service';
import type { VerificationLimits } from '@app/auth/application/verification-limits';

describe('verification throttle (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: AuthPrismaService;
  let repository: VerificationThrottlePrismaRepository;
  let rateLimit: VerificationRateLimitService;

  const limits: VerificationLimits = {
    resendWindowSeconds: 60,
    sourceWindowSeconds: 3600,
    sourceMax: 20,
    retentionSeconds: 86400,
  };

  const now = new Date('2026-01-01T00:00:00.000Z');

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(AuthPrismaService);
    repository = new VerificationThrottlePrismaRepository(prisma);
    rateLimit = new VerificationRateLimitService(repository, limits);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    await prisma.verificationResendThrottle.deleteMany({});
    await prisma.pendingRegistration.deleteMany({});
  });

  it('allows one reservation per window and resets after it elapses', async () => {
    const first = await repository.reserve({
      identifier: 'email:ada@example.com',
      windowSeconds: 60,
      max: 1,
      now,
    });
    expect(first.allowed).toBe(true);

    const blocked = await repository.reserve({
      identifier: 'email:ada@example.com',
      windowSeconds: 60,
      max: 1,
      now: new Date(now.getTime() + 30_000),
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

    const afterWindow = await repository.reserve({
      identifier: 'email:ada@example.com',
      windowSeconds: 60,
      max: 1,
      now: new Date(now.getTime() + 61_000),
    });
    expect(afterWindow.allowed).toBe(true);
  });

  it('caps the counter when a reservation is denied', async () => {
    await repository.reserve({
      identifier: 'ip:1.2.3.4',
      windowSeconds: 3600,
      max: 2,
      now,
    });
    await repository.reserve({
      identifier: 'ip:1.2.3.4',
      windowSeconds: 3600,
      max: 2,
      now,
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const denied = await repository.reserve({
        identifier: 'ip:1.2.3.4',
        windowSeconds: 3600,
        max: 2,
        now,
      });
      expect(denied.allowed).toBe(false);
    }

    const row = await prisma.verificationResendThrottle.findUnique({
      where: { identifier: 'ip:1.2.3.4' },
    });
    expect(row?.count).toBe(2);
  });

  it('permits exactly one of many concurrent reservations', async () => {
    const attempts = await Promise.all(
      Array.from({ length: 5 }, () =>
        rateLimit.reserve('10.0.0.1', 'concurrent@example.com', now),
      ),
    );

    expect(attempts.filter((attempt) => attempt.allowed)).toHaveLength(1);
  });

  it('blocks a source without creating per-address rows for later emails', async () => {
    const source = '203.0.113.7';
    const sourceLimits: VerificationLimits = { ...limits, sourceMax: 2 };
    const limiter = new VerificationRateLimitService(repository, sourceLimits);

    const first = await limiter.reserve(source, 'a@example.com', now);
    const second = await limiter.reserve(source, 'b@example.com', now);
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);

    for (const email of ['c@example.com', 'd@example.com', 'e@example.com']) {
      const denied = await limiter.reserve(source, email, now);
      expect(denied.allowed).toBe(false);
      expect(denied.reason).toBe('source');
    }

    const addressRows = await prisma.verificationResendThrottle.findMany({
      where: { identifier: { startsWith: 'email:' } },
    });
    expect(addressRows).toHaveLength(2);

    const blockedRows = await prisma.verificationResendThrottle.findMany({
      where: {
        identifier: {
          in: [
            'email:c@example.com',
            'email:d@example.com',
            'email:e@example.com',
          ],
        },
      },
    });
    expect(blockedRows).toHaveLength(0);
  });

  it('isolates independent sources', async () => {
    const sourceLimits: VerificationLimits = { ...limits, sourceMax: 1 };
    const limiter = new VerificationRateLimitService(repository, sourceLimits);

    const first = await limiter.reserve('192.0.2.1', 'one@example.com', now);
    const blockedSameSource = await limiter.reserve(
      '192.0.2.1',
      'two@example.com',
      now,
    );
    const otherSource = await limiter.reserve(
      '192.0.2.2',
      'three@example.com',
      now,
    );

    expect(first.allowed).toBe(true);
    expect(blockedSameSource.allowed).toBe(false);
    expect(otherSource.allowed).toBe(true);
  });

  it('removes throttle rows older than the retention cutoff', async () => {
    await repository.reserve({
      identifier: 'email:old@example.com',
      windowSeconds: 60,
      max: 1,
      now: new Date(now.getTime() - 2 * 24 * 3600 * 1000),
    });

    const removed = await repository.deleteOlderThan(
      new Date(now.getTime() - 24 * 3600 * 1000),
    );

    expect(removed).toBe(1);
    const remaining = await prisma.verificationResendThrottle.count();
    expect(remaining).toBe(0);
  });
});
