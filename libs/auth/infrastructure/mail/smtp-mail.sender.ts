import { Injectable } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import type { MailMessage, MailPort } from '../../application/mail.port';
import { AuthProviderError } from '../../application/auth.errors';

@Injectable()
export class SmtpMailSender implements MailPort {
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT ?? 587);
    this.from = process.env.MAIL_FROM ?? 'no-reply@example.com';
    this.transporter = host
      ? createTransport({
          host,
          port,
          secure: port === 465,
          auth: process.env.SMTP_USER
            ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD ?? '',
              }
            : undefined,
        })
      : null;
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.transporter) {
      throw new AuthProviderError('SMTP transport is not configured');
    }

    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  }
}
