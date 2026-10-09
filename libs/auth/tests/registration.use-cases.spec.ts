/* eslint-disable @typescript-eslint/require-await */
import { describe, expect, it, jest } from '@jest/globals';
import { PendingRegistration } from '../domain/pending-registration';
import type {
  PendingRegistrationRepository,
  ResolveRegistrationResult,
} from '../application/pending-registration.repository';
import type { VerificationRateLimitService } from '../application/verification-rate-limit.service';
import type { IdentityLookupPort } from '../application/identity-lookup.port';
import type { VerificationMailer } from '../application/verification-mailer.port';
import type { Clock } from '../application/clock.port';
import { StartRegistrationUseCase } from '../application/use-cases/start-registration.use-case';
import { ResendVerificationUseCase } from '../application/use-cases/resend-verification.use-case';
import { SourceBlockedError } from '../application/auth.errors';

class InMemoryRegistrations implements PendingRegistrationRepository {
  rows = new Map<string, PendingRegistration>();

  async findByEmail(email: string): Promise<PendingRegistration | null> {
    return this.rows.get(email.trim().toLowerCase()) ?? null;
  }

  async findByTokenHash(
    tokenHash: string,
  ): Promise<PendingRegistration | null> {
    for (const row of this.rows.values()) {
      if (row.tokenHash === tokenHash) {
        return row;
      }
    }
    return null;
  }

  async create(registration: PendingRegistration): Promise<void> {
    this.rows.set(registration.email, registration);
  }

  async resolveForRequest(input: {
    email: string;
    now: Date;
    newId: string;
  }): Promise<ResolveRegistrationResult> {
    const key = input.email.trim().toLowerCase();
    const existing = this.rows.get(key);
    if (existing && existing.isActive(input.now)) {
      return { registration: existing, restarted: false };
    }

    const created = PendingRegistration.initiate({
      id: input.newId,
      email: key,
      initiatedAt: input.now,
    });
    this.rows.set(key, created);
    return { registration: created, restarted: true };
  }

  async saveTokenHash(registration: PendingRegistration): Promise<void> {
    this.rows.set(registration.email, registration);
  }

  async consume(input: {
    id: string;
    tokenHash: string;
    now: Date;
  }): Promise<boolean> {
    for (const row of this.rows.values()) {
      if (
        row.id === input.id &&
        row.tokenHash === input.tokenHash &&
        !row.isConsumed() &&
        !row.isExpired(input.now)
      ) {
        this.rows.set(row.email, row.withConsumedAt(input.now));
        return true;
      }
    }
    return false;
  }

  async deleteExpired(now: Date): Promise<number> {
    let removed = 0;
    for (const [key, row] of this.rows) {
      if (row.isExpired(now)) {
        this.rows.delete(key);
        removed += 1;
      }
    }
    return removed;
  }
}

const NOW = new Date('2026-01-01T00:00:00.000Z');

function clockAt(now: Date): Clock {
  return { now: () => now };
}

function identity(verified: boolean): IdentityLookupPort {
  return { emailHasVerifiedIdentity: jest.fn(async () => verified) };
}

function mailer(send: () => Promise<void>): VerificationMailer {
  return { sendVerification: jest.fn(send) };
}

function rateLimit(decision: {
  allowed: boolean;
  retryAfterSeconds: number;
  reason: 'source' | 'address' | null;
}): VerificationRateLimitService {
  return {
    reserve: jest.fn(async () => decision),
  } as unknown as VerificationRateLimitService;
}

function context() {
  return { sourceIp: '203.0.113.1' };
}

describe('StartRegistrationUseCase', () => {
  it('creates a pending registration and sends the activation link', async () => {
    const registrations = new InMemoryRegistrations();
    const send: () => Promise<void> = jest.fn(async () => undefined);
    const useCase = new StartRegistrationUseCase(
      registrations,
      rateLimit({ allowed: true, retryAfterSeconds: 0, reason: null }),
      identity(false),
      mailer(send),
      clockAt(NOW),
    );

    const result = await useCase.execute(
      { email: 'Ada@Example.com' },
      context(),
    );

    expect(result.status).toBe('pending-verification');
    expect(result.emailStatus).toBe('accepted');
    expect(result.expiresAt).toEqual(
      new Date(NOW.getTime() + 48 * 60 * 60 * 1000),
    );
    expect(registrations.rows.get('ada@example.com')?.tokenHash).toBeTruthy();
    expect(send).toHaveBeenCalledWith('ada@example.com', expect.any(String));
  });

  it('reuses an unexpired registration without extending the deadline', async () => {
    const registrations = new InMemoryRegistrations();
    const existing = PendingRegistration.initiate({
      id: 'reg-1',
      email: 'ada@example.com',
      initiatedAt: NOW,
    }).withTokenHash('old-hash');
    registrations.rows.set('ada@example.com', existing);

    const send: () => Promise<void> = jest.fn(async () => undefined);
    const useCase = new StartRegistrationUseCase(
      registrations,
      rateLimit({ allowed: true, retryAfterSeconds: 0, reason: null }),
      identity(false),
      mailer(send),
      clockAt(new Date(NOW.getTime() + 60_000)),
    );

    const result = await useCase.execute(
      { email: 'ada@example.com' },
      context(),
    );

    expect(result.expiresAt).toEqual(existing.expiresAt);
    const stored = registrations.rows.get('ada@example.com');
    expect(stored?.id).toBe('reg-1');
    expect(stored?.tokenHash).not.toBe('old-hash');
  });

  it('restarts an expired registration with a new id and deadline', async () => {
    const registrations = new InMemoryRegistrations();
    const existing = PendingRegistration.initiate({
      id: 'reg-old',
      email: 'ada@example.com',
      initiatedAt: new Date(NOW.getTime() - 49 * 60 * 60 * 1000),
    }).withTokenHash('old-hash');
    registrations.rows.set('ada@example.com', existing);

    const useCase = new StartRegistrationUseCase(
      registrations,
      rateLimit({ allowed: true, retryAfterSeconds: 0, reason: null }),
      identity(false),
      mailer(async () => undefined),
      clockAt(NOW),
    );

    const result = await useCase.execute(
      { email: 'ada@example.com' },
      context(),
    );

    const stored = registrations.rows.get('ada@example.com');
    expect(stored?.id).not.toBe('reg-old');
    expect(result.expiresAt).toEqual(
      new Date(NOW.getTime() + 48 * 60 * 60 * 1000),
    );
    expect(stored?.tokenHash).not.toBe('old-hash');
  });

  it('reports a failed send but keeps the registration for resend', async () => {
    const registrations = new InMemoryRegistrations();
    const useCase = new StartRegistrationUseCase(
      registrations,
      rateLimit({ allowed: true, retryAfterSeconds: 0, reason: null }),
      identity(false),
      mailer(async () => {
        throw new Error('smtp down');
      }),
      clockAt(NOW),
    );

    const result = await useCase.execute(
      { email: 'ada@example.com' },
      context(),
    );

    expect(result.emailStatus).toBe('failed');
    expect(registrations.rows.get('ada@example.com')).toBeTruthy();
  });

  it('rejects a source-blocked signup without creating a registration', async () => {
    const registrations = new InMemoryRegistrations();
    const useCase = new StartRegistrationUseCase(
      registrations,
      rateLimit({ allowed: false, retryAfterSeconds: 30, reason: 'source' }),
      identity(false),
      mailer(async () => undefined),
      clockAt(NOW),
    );

    await expect(
      useCase.execute({ email: 'ada@example.com' }, context()),
    ).rejects.toBeInstanceOf(SourceBlockedError);
    expect(registrations.rows.size).toBe(0);
  });

  it('retains the registration and reports throttled without sending', async () => {
    const registrations = new InMemoryRegistrations();
    const send: () => Promise<void> = jest.fn(async () => undefined);
    const useCase = new StartRegistrationUseCase(
      registrations,
      rateLimit({ allowed: false, retryAfterSeconds: 45, reason: 'address' }),
      identity(false),
      mailer(send),
      clockAt(NOW),
    );

    const result = await useCase.execute(
      { email: 'ada@example.com' },
      context(),
    );

    expect(result.emailStatus).toBe('throttled');
    expect(result.retryAfterSeconds).toBe(45);
    expect(send).not.toHaveBeenCalled();
    expect(registrations.rows.get('ada@example.com')).toBeTruthy();
  });
});

describe('ResendVerificationUseCase', () => {
  it('rotates the token and sends for a pending registration', async () => {
    const registrations = new InMemoryRegistrations();
    const pending = PendingRegistration.initiate({
      id: 'reg-1',
      email: 'ada@example.com',
      initiatedAt: NOW,
    }).withTokenHash('old-hash');
    registrations.rows.set('ada@example.com', pending);

    const send: () => Promise<void> = jest.fn(async () => undefined);
    const useCase = new ResendVerificationUseCase(
      registrations,
      rateLimit({ allowed: true, retryAfterSeconds: 0, reason: null }),
      identity(false),
      mailer(send),
      clockAt(new Date(NOW.getTime() + 60_000)),
    );

    const result = await useCase.execute(
      { email: 'ada@example.com' },
      context(),
    );

    expect(result).toEqual({ status: 'accepted' });
    expect(registrations.rows.get('ada@example.com')?.tokenHash).not.toBe(
      'old-hash',
    );
    expect(registrations.rows.get('ada@example.com')?.expiresAt).toEqual(
      pending.expiresAt,
    );
    expect(send).toHaveBeenCalled();
  });

  it('returns uniform acceptance without sending for an unknown address', async () => {
    const send: () => Promise<void> = jest.fn(async () => undefined);
    const useCase = new ResendVerificationUseCase(
      new InMemoryRegistrations(),
      rateLimit({ allowed: true, retryAfterSeconds: 0, reason: null }),
      identity(false),
      mailer(send),
      clockAt(NOW),
    );

    await expect(
      useCase.execute({ email: 'unknown@example.com' }, context()),
    ).resolves.toEqual({ status: 'accepted' });
    expect(send).not.toHaveBeenCalled();
  });

  it('does not send for a verified identity', async () => {
    const send: () => Promise<void> = jest.fn(async () => undefined);
    const useCase = new ResendVerificationUseCase(
      new InMemoryRegistrations(),
      rateLimit({ allowed: true, retryAfterSeconds: 0, reason: null }),
      identity(true),
      mailer(send),
      clockAt(NOW),
    );

    await useCase.execute({ email: 'ada@example.com' }, context());
    expect(send).not.toHaveBeenCalled();
  });

  it('returns the retry interval when throttled without rotating the token', async () => {
    const registrations = new InMemoryRegistrations();
    registrations.rows.set(
      'ada@example.com',
      PendingRegistration.initiate({
        id: 'reg-1',
        email: 'ada@example.com',
        initiatedAt: NOW,
      }).withTokenHash('old-hash'),
    );

    const send: () => Promise<void> = jest.fn(async () => undefined);
    const useCase = new ResendVerificationUseCase(
      registrations,
      rateLimit({ allowed: false, retryAfterSeconds: 20, reason: 'address' }),
      identity(false),
      mailer(send),
      clockAt(NOW),
    );

    const result = await useCase.execute(
      { email: 'ada@example.com' },
      context(),
    );

    expect(result).toEqual({ status: 'accepted', retryAfterSeconds: 20 });
    expect(registrations.rows.get('ada@example.com')?.tokenHash).toBe(
      'old-hash',
    );
    expect(send).not.toHaveBeenCalled();
  });

  it('returns uniform acceptance and keeps the rotated token when the transport fails', async () => {
    const registrations = new InMemoryRegistrations();
    registrations.rows.set(
      'ada@example.com',
      PendingRegistration.initiate({
        id: 'reg-1',
        email: 'ada@example.com',
        initiatedAt: NOW,
      }).withTokenHash('old-hash'),
    );

    const send: () => Promise<void> = jest.fn(async () => {
      throw new Error('smtp down');
    });
    const useCase = new ResendVerificationUseCase(
      registrations,
      rateLimit({ allowed: true, retryAfterSeconds: 0, reason: null }),
      identity(false),
      mailer(send),
      clockAt(NOW),
    );

    await expect(
      useCase.execute({ email: 'ada@example.com' }, context()),
    ).resolves.toEqual({ status: 'accepted' });

    // The latest link supersedes the previous one even when delivery failed,
    // and the request acceptance never discloses the transport outcome.
    expect(send).toHaveBeenCalled();
    expect(registrations.rows.get('ada@example.com')?.tokenHash).not.toBe(
      'old-hash',
    );
  });
});
