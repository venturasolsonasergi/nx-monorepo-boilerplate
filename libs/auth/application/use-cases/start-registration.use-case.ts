import { randomUUID } from 'node:crypto';
import { EmailValueObject } from '../../domain/email.vo';
import { RegistrationToken } from '../../domain/registration-token.vo';
import { EmailAlreadyExistsError, SourceBlockedError } from '../auth.errors';
import type { Clock } from '../clock.port';
import type { IdentityLookupPort } from '../identity-lookup.port';
import type { PendingRegistrationRepository } from '../pending-registration.repository';
import type { RequestContext } from '../request-context';
import type { VerificationMailer } from '../verification-mailer.port';
import type { VerificationRateLimitService } from '../verification-rate-limit.service';

export interface StartRegistrationInput {
  email: string;
}

export interface StartRegistrationOutput {
  status: 'pending-verification';
  expiresAt: Date;
  emailStatus: 'accepted' | 'failed' | 'throttled';
  retryAfterSeconds?: number;
}

export class StartRegistrationUseCase {
  constructor(
    private readonly registrations: PendingRegistrationRepository,
    private readonly rateLimit: VerificationRateLimitService,
    private readonly identityLookup: IdentityLookupPort,
    private readonly mailer: VerificationMailer,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: StartRegistrationInput,
    context: RequestContext,
  ): Promise<StartRegistrationOutput> {
    const email = new EmailValueObject(input.email).value;

    if (await this.identityLookup.emailHasVerifiedIdentity(email)) {
      throw new EmailAlreadyExistsError();
    }

    const now = this.clock.now();
    const decision = await this.rateLimit.reserve(
      context.sourceIp ?? 'unknown',
      email,
      now,
    );

    if (!decision.allowed && decision.reason === 'source') {
      throw new SourceBlockedError(decision.retryAfterSeconds);
    }

    const existing = await this.registrations.resolveForRequest({
      email,
      now,
      newId: randomUUID(),
    });
    const registration = existing.registration;

    if (!decision.allowed) {
      return {
        status: 'pending-verification',
        expiresAt: registration.expiresAt,
        emailStatus: 'throttled',
        retryAfterSeconds: decision.retryAfterSeconds,
      };
    }

    const token = RegistrationToken.generate();
    await this.registrations.saveTokenHash(
      registration.withTokenHash(token.hash),
    );

    let emailStatus: 'accepted' | 'failed' = 'accepted';
    try {
      await this.mailer.sendVerification(email, token.value);
    } catch {
      emailStatus = 'failed';
    }

    return {
      status: 'pending-verification',
      expiresAt: registration.expiresAt,
      emailStatus,
    };
  }
}
