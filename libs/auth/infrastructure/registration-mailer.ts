import { Inject, Injectable } from '@nestjs/common';
import type { MailPort } from '../application/mail.port';
import type { VerificationMailer } from '../application/verification-mailer.port';
import { AUTH_CONFIG, MAIL_PORT, type AuthConfig } from './auth.config';

@Injectable()
export class RegistrationMailer implements VerificationMailer {
  constructor(
    @Inject(MAIL_PORT) private readonly mail: MailPort,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  async sendVerification(email: string, token: string): Promise<void> {
    const url = new URL('/auth/verify-email', this.config.baseURL);
    url.searchParams.set('token', token);

    await this.mail.send({
      to: email,
      subject: 'Verify your email',
      text: `Verify your email by visiting: ${url.toString()}`,
    });
  }
}
