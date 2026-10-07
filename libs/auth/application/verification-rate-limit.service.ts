import type { VerificationLimits } from './verification-limits';
import type { VerificationThrottleRepository } from './verification-throttle.repository';

export type VerificationLimitReason = 'source' | 'address';

export interface VerificationLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  reason: VerificationLimitReason | null;
}

export function normalizeThrottleEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class VerificationRateLimitService {
  constructor(
    private readonly throttle: VerificationThrottleRepository,
    private readonly limits: VerificationLimits,
  ) {}

  async reserve(
    source: string,
    email: string,
    now: Date,
  ): Promise<VerificationLimitDecision> {
    const sourceDecision = await this.throttle.reserve({
      identifier: `ip:${source}`,
      windowSeconds: this.limits.sourceWindowSeconds,
      max: this.limits.sourceMax,
      now,
    });

    if (!sourceDecision.allowed) {
      return {
        allowed: false,
        retryAfterSeconds: sourceDecision.retryAfterSeconds,
        reason: 'source',
      };
    }

    const addressDecision = await this.throttle.reserve({
      identifier: `email:${normalizeThrottleEmail(email)}`,
      windowSeconds: this.limits.resendWindowSeconds,
      max: 1,
      now,
    });

    if (!addressDecision.allowed) {
      return {
        allowed: false,
        retryAfterSeconds: addressDecision.retryAfterSeconds,
        reason: 'address',
      };
    }

    return { allowed: true, retryAfterSeconds: 0, reason: null };
  }

  /**
   * Reserves only the per-source budget. Used by flows that must not touch the
   * per-address verification window, such as registration completion.
   */
  async reserveSource(
    source: string,
    now: Date,
  ): Promise<VerificationLimitDecision> {
    const decision = await this.throttle.reserve({
      identifier: `ip:${source}`,
      windowSeconds: this.limits.sourceWindowSeconds,
      max: this.limits.sourceMax,
      now,
    });

    return {
      allowed: decision.allowed,
      retryAfterSeconds: decision.retryAfterSeconds,
      reason: decision.allowed ? null : 'source',
    };
  }
}
