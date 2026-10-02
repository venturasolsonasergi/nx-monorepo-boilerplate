import type { AuthProvider } from '../auth-provider.port';
import { EmailValueObject } from '../../domain/email.vo';
import { PasswordValueObject } from '../../domain/password.vo';

export interface SignUpInput {
  email: string;
  password: string;
}

export interface SignUpOutput {
  userId: string;
  status: 'pending-verification';
}

export class SignUpUseCase {
  constructor(private readonly provider: AuthProvider) {}

  async execute(input: SignUpInput): Promise<SignUpOutput> {
    const email = new EmailValueObject(input.email);
    const password = new PasswordValueObject(input.password);
    const { userId } = await this.provider.signUp({
      email: email.value,
      password: password.value,
    });

    return { userId, status: 'pending-verification' };
  }
}
