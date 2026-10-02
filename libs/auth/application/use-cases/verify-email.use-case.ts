import type { AuthProvider } from '../auth-provider.port';
import { InvalidVerificationTokenError } from '../auth.errors';

export interface VerifyEmailInput {
  token: string;
}

export interface VerifyEmailOutput {
  status: 'verified';
}

export class VerifyEmailUseCase {
  constructor(private readonly provider: AuthProvider) {}

  async execute(input: VerifyEmailInput): Promise<VerifyEmailOutput> {
    if (!input.token || input.token.trim().length === 0) {
      throw new InvalidVerificationTokenError();
    }

    await this.provider.verifyEmail(input.token);
    return { status: 'verified' };
  }
}
