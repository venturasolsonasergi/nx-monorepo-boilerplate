import type { PendingRegistration } from '../domain/pending-registration';

export const REGISTRATION_REPOSITORY = Symbol('REGISTRATION_REPOSITORY');

export interface ResolveRegistrationResult {
  registration: PendingRegistration;
  restarted: boolean;
}

export interface PendingRegistrationRepository {
  findByEmail(email: string): Promise<PendingRegistration | null>;
  findByTokenHash(tokenHash: string): Promise<PendingRegistration | null>;
  /**
   * Atomically locks the registration for the email and either reuses an
   * existing active registration or replaces an expired/consumed one with a
   * freshly created registration (new id and deadline). Callers must never
   * delete-and-recreate outside this call, so a concurrent request can never
   * invalidate a token that was just persisted.
   */
  resolveForRequest(input: {
    email: string;
    now: Date;
    newId: string;
  }): Promise<ResolveRegistrationResult>;
  saveTokenHash(registration: PendingRegistration): Promise<void>;
  consume(input: {
    id: string;
    tokenHash: string;
    now: Date;
  }): Promise<boolean>;
  deleteExpired(now: Date): Promise<number>;
}
