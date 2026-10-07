import { Inject, Injectable } from '@nestjs/common';
import type {
  ThrottleReservation,
  VerificationThrottleRepository,
} from '../application/verification-throttle.repository';
import { AuthPrismaService } from './prisma/prisma.service';

interface ThrottleRow {
  window_started_at: Date;
  count: number;
}

export function secondsUntilWindowEnds(
  windowStartedAt: Date,
  windowSeconds: number,
  now: Date,
): number {
  const end = windowStartedAt.getTime() + windowSeconds * 1000;
  return Math.max(1, Math.ceil((end - now.getTime()) / 1000));
}

@Injectable()
export class VerificationThrottlePrismaRepository implements VerificationThrottleRepository {
  constructor(
    @Inject(AuthPrismaService) private readonly prisma: AuthPrismaService,
  ) {}

  async reserve(input: {
    identifier: string;
    windowSeconds: number;
    max: number;
    now: Date;
  }): Promise<ThrottleReservation> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "auth_verification_resend_throttle" ("identifier", "window_started_at", "count")
        VALUES (${input.identifier}, ${input.now}, 0)
        ON CONFLICT ("identifier") DO NOTHING
      `;

      const rows = await tx.$queryRaw<ThrottleRow[]>`
        SELECT "window_started_at", "count"
        FROM "auth_verification_resend_throttle"
        WHERE "identifier" = ${input.identifier}
        FOR UPDATE
      `;

      const current = rows[0];
      const cutoff = new Date(input.now.getTime() - input.windowSeconds * 1000);

      let allowed: boolean;
      let windowStartedAt: Date;
      let count: number;

      if (
        current === undefined ||
        current.window_started_at.getTime() <= cutoff.getTime()
      ) {
        allowed = true;
        windowStartedAt = input.now;
        count = 1;
      } else if (current.count < input.max) {
        allowed = true;
        windowStartedAt = current.window_started_at;
        count = current.count + 1;
      } else {
        allowed = false;
        windowStartedAt = current.window_started_at;
        count = current.count;
      }

      await tx.$executeRaw`
        UPDATE "auth_verification_resend_throttle"
        SET "window_started_at" = ${windowStartedAt}, "count" = ${count}
        WHERE "identifier" = ${input.identifier}
      `;

      return {
        allowed,
        retryAfterSeconds: allowed
          ? 0
          : secondsUntilWindowEnds(
              windowStartedAt,
              input.windowSeconds,
              input.now,
            ),
        count,
      };
    });
  }

  async deleteOlderThan(cutoff: Date): Promise<number> {
    const result = await this.prisma.verificationResendThrottle.deleteMany({
      where: { windowStartedAt: { lt: cutoff } },
    });

    return result.count;
  }
}
