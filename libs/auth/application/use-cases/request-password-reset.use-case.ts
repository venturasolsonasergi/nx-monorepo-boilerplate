import type { AuthProvider } from '../auth-provider.port';

export interface RequestPasswordResetInput {
  email: string;
}

export interface RequestPasswordResetOutput {
  status: 'accepted';
  message: string;
}

export class RequestPasswordResetUseCase {
  constructor(private readonly provider: AuthProvider) {}

  async execute(
    input: RequestPasswordResetInput,
  ): Promise<RequestPasswordResetOutput> {
    await this.provider.requestPasswordReset(input.email);

    return {
      status: 'accepted',
      message:
        'If this email exists in our system, check your email for the reset link',
    };
  }
}
