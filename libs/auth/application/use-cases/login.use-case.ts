import type { AuthProvider, SessionResult } from '../auth-provider.port';
import { EmailValueObject } from '../../domain/email.vo';

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginOutput extends SessionResult {
  status: 'authenticated';
}

export class LoginUseCase {
  constructor(private readonly provider: AuthProvider) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const email = new EmailValueObject(input.email);
    const result = await this.provider.login({
      email: email.value,
      password: input.password,
    });

    return { ...result, status: 'authenticated' };
  }
}
