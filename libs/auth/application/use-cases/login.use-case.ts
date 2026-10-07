import type { AuthProvider, SessionResult } from '../auth-provider.port';
import type { RequestContext } from '../request-context';
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

  async execute(
    input: LoginInput,
    context: RequestContext,
  ): Promise<LoginOutput> {
    const email = new EmailValueObject(input.email);
    const result = await this.provider.login(
      {
        email: email.value,
        password: input.password,
      },
      context,
    );

    return { ...result, status: 'authenticated' };
  }
}
