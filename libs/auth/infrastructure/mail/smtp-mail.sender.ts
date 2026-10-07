import { Inject, Injectable } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import type { MailMessage, MailPort } from '../../application/mail.port';
import { AuthProviderError } from '../../application/auth.errors';
import {
  AUTH_CONFIG,
  SMTP_TRANSPORTER,
  type AuthConfig,
  type SmtpConfig,
} from '../auth.config';

export interface SmtpSendResult {
  accepted: Array<string | { address: string }>;
  rejected: Array<string | { address: string }>;
}

export interface SmtpTransporter {
  sendMail(options: {
    from: string;
    to: string;
    subject: string;
    text: string;
  }): Promise<SmtpSendResult>;
}

export function createSmtpTransporter(
  smtp: SmtpConfig | null,
): SmtpTransporter | null {
  if (!smtp) {
    return null;
  }

  return createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user
      ? { user: smtp.user, pass: smtp.password ?? '' }
      : undefined,
  });
}

function addressOf(entry: string | { address: string }): string {
  return typeof entry === 'string' ? entry : entry.address;
}

export function isRecipientAccepted(
  accepted: Array<string | { address: string }>,
  to: string,
): boolean {
  const target = to.trim().toLowerCase();
  return accepted.some(
    (entry) => addressOf(entry).trim().toLowerCase() === target,
  );
}

@Injectable()
export class SmtpMailSender implements MailPort {
  constructor(
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
    @Inject(SMTP_TRANSPORTER)
    private readonly transporter: SmtpTransporter | null,
  ) {}

  async send(message: MailMessage): Promise<void> {
    const smtp = this.config.smtp;
    if (!this.transporter || !smtp) {
      throw new AuthProviderError('SMTP transport is not configured');
    }

    let result: SmtpSendResult;
    try {
      result = await this.transporter.sendMail({
        from: smtp.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
    } catch (error) {
      throw new AuthProviderError('SMTP transport failed', error);
    }

    if (!isRecipientAccepted(result.accepted, message.to)) {
      throw new AuthProviderError('SMTP did not accept the recipient');
    }
  }
}
