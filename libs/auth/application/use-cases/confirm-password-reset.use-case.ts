import type { AuthProvider } from '../auth-provider.port';
import { PasswordValueObject } from '../../domain/password.vo';
import { InvalidResetTokenError } from '../auth.errors';

export interface ConfirmPasswordResetInput {
  token: string;
  password: string;
}

export interface ConfirmPasswordResetOutput {
  status: 'ok';
}

export class ConfirmPasswordResetUseCase {
  constructor(private readonly provider: AuthProvider) {}

  async execute(
    input: ConfirmPasswordResetInput,
  ): Promise<ConfirmPasswordResetOutput> {
    if (!input.token || input.token.trim().length === 0) {
      throw new InvalidResetTokenError();
    }

    const password = new PasswordValueObject(input.password);
    await this.provider.confirmPasswordReset({
      token: input.token,
      password: password.value,
    });

    return { status: 'ok' };
  }
}
