import { EmailValueObject } from '../../domain/email.vo';
import { RegistrationToken } from '../../domain/registration-token.vo';
import type { Clock } from '../clock.port';
import type { IdentityLookupPort } from '../identity-lookup.port';
import type { PendingRegistrationRepository } from '../pending-registration.repository';
import type { RequestContext } from '../request-context';
import type { VerificationMailer } from '../verification-mailer.port';
import type { VerificationRateLimitService } from '../verification-rate-limit.service';

export interface ResendVerificationInput {
  email: string;
}

export interface ResendVerificationOutput {
  status: 'accepted';
  retryAfterSeconds?: number;
}

export class ResendVerificationUseCase {
  constructor(
    private readonly registrations: PendingRegistrationRepository,
    private readonly rateLimit: VerificationRateLimitService,
    private readonly identityLookup: IdentityLookupPort,
    private readonly mailer: VerificationMailer,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: ResendVerificationInput,
    context: RequestContext,
  ): Promise<ResendVerificationOutput> {
    const email = new EmailValueObject(input.email).value;
    const now = this.clock.now();
    const decision = await this.rateLimit.reserve(
      context.sourceIp ?? 'unknown',
      email,
      now,
    );

    if (!decision.allowed) {
      return {
        status: 'accepted',
        retryAfterSeconds: decision.retryAfterSeconds,
      };
    }

    if (await this.identityLookup.emailHasVerifiedIdentity(email)) {
      return { status: 'accepted' };
    }

    const registration = await this.registrations.findByEmail(email);
    if (!registration || !registration.isActive(now)) {
      return { status: 'accepted' };
    }

    const token = RegistrationToken.generate();
    await this.registrations.saveTokenHash(
      registration.withTokenHash(token.hash),
    );

    try {
      await this.mailer.sendVerification(email, token.value);
    } catch {
      // Request acceptance is uniform; the transport failure is operational.
    }

    return { status: 'accepted' };
  }
}
