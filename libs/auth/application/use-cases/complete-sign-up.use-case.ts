import { PasswordValueObject } from '../../domain/password.vo';
import { RegistrationToken } from '../../domain/registration-token.vo';
import {
  ActivationCommittedError,
  AuthProviderError,
  InvalidPasswordError,
  InvalidVerificationTokenError,
  RateLimitedError,
  SourceBlockedError,
} from '../auth.errors';
import type { AuthProvider } from '../auth-provider.port';
import type { Clock } from '../clock.port';
import type { RegistrationActivationPort } from '../registration-activation.port';
import type { RequestContext } from '../request-context';
import type { VerificationRateLimitService } from '../verification-rate-limit.service';

export interface CompleteSignUpInput {
  token: string;
  password: string;
}

export interface CompleteSignUpOutput {
  userId: string;
  status: 'authenticated';
  setCookie: string[];
}

export class CompleteSignUpUseCase {
  constructor(
    private readonly activation: RegistrationActivationPort,
    private readonly provider: AuthProvider,
    private readonly rateLimit: VerificationRateLimitService,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: CompleteSignUpInput,
    context: RequestContext,
  ): Promise<CompleteSignUpOutput> {
    if (!input.token || input.token.trim().length === 0) {
      throw new InvalidVerificationTokenError();
    }

    let password: string;
    try {
      password = new PasswordValueObject(input.password).value;
    } catch {
      throw new InvalidPasswordError();
    }

    // Bound completion before any expensive work so invented tokens cannot
    // repeatedly trigger password hashing.
    const decision = await this.rateLimit.reserveSource(
      context.sourceIp ?? 'unknown',
      this.clock.now(),
    );
    if (!decision.allowed) {
      throw new SourceBlockedError(decision.retryAfterSeconds);
    }

    const tokenHash = RegistrationToken.hash(input.token);
    const { email } = await this.activation.activate({ tokenHash, password });

    try {
      const result = await this.provider.login({ email, password }, context);
      return {
        userId: result.session.userId,
        status: 'authenticated',
        setCookie: result.setCookie,
      };
    } catch (error) {
      if (
        error instanceof RateLimitedError ||
        error instanceof AuthProviderError
      ) {
        throw new ActivationCommittedError(error);
      }
      throw error;
    }
  }
}
