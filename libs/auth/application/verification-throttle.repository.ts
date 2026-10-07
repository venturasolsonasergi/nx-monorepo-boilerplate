export const VERIFICATION_THROTTLE_REPOSITORY = Symbol(
  'VERIFICATION_THROTTLE_REPOSITORY',
);

export interface ThrottleReservation {
  allowed: boolean;
  retryAfterSeconds: number;
  count: number;
}

export interface VerificationThrottleRepository {
  reserve(input: {
    identifier: string;
    windowSeconds: number;
    max: number;
    now: Date;
  }): Promise<ThrottleReservation>;
  deleteOlderThan(cutoff: Date): Promise<number>;
}
