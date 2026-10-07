import { describe, expect, it, jest } from '@jest/globals';
import {
  SmtpMailSender,
  isRecipientAccepted,
} from '../infrastructure/mail/smtp-mail.sender';
import { AuthProviderError } from '../application/auth.errors';
import type { AuthConfig } from '../infrastructure/auth.config';

function configWithSmtp(host: string | null): AuthConfig {
  return {
    secret: 'test-secret',
    baseURL: 'http://localhost:3000',
    webURL: 'http://localhost:4200',
    basePath: '/auth',
    trustedOrigins: ['http://localhost:4200'],
    allowedProviders: [],
    socialProviders: {},
    isProduction: false,
    supportEmail: null,
    smtp: host
      ? {
          host,
          port: 1025,
          secure: false,
          user: null,
          password: null,
          from: 'no-reply@example.com',
        }
      : null,
    verificationLimits: {
      resendWindowSeconds: 60,
      sourceWindowSeconds: 3600,
      sourceMax: 20,
      retentionSeconds: 86400,
    },
  };
}

describe('SmtpMailSender', () => {
  it('rejects sending when SMTP is not configured', async () => {
    const sender = new SmtpMailSender(configWithSmtp(null), null);

    await expect(
      sender.send({ to: 'ada@example.com', subject: 's', text: 't' }),
    ).rejects.toBeInstanceOf(AuthProviderError);
  });

  it('accepts a message when the recipient is accepted', async () => {
    const sendMail = jest.fn().mockResolvedValue({
      accepted: ['ada@example.com'],
      rejected: [],
    });
    const sender = new SmtpMailSender(configWithSmtp('mailpit'), {
      sendMail,
    });

    await expect(
      sender.send({ to: 'ada@example.com', subject: 'Subject', text: 'Body' }),
    ).resolves.toBeUndefined();

    expect(sendMail).toHaveBeenCalledWith({
      from: 'no-reply@example.com',
      to: 'ada@example.com',
      subject: 'Subject',
      text: 'Body',
    });
  });

  it('rejects sending when the recipient is rejected by the transport', async () => {
    const sender = new SmtpMailSender(configWithSmtp('mailpit'), {
      sendMail: jest.fn().mockResolvedValue({
        accepted: [],
        rejected: ['ada@example.com'],
      }),
    });

    await expect(
      sender.send({ to: 'ada@example.com', subject: 's', text: 't' }),
    ).rejects.toBeInstanceOf(AuthProviderError);
  });

  it('preserves transport failures', async () => {
    const sender = new SmtpMailSender(configWithSmtp('mailpit'), {
      sendMail: jest.fn().mockRejectedValue(new Error('connection refused')),
    });

    await expect(
      sender.send({ to: 'ada@example.com', subject: 's', text: 't' }),
    ).rejects.toBeInstanceOf(AuthProviderError);
  });
});

describe('isRecipientAccepted', () => {
  it('matches plain and object addresses case-insensitively', () => {
    expect(isRecipientAccepted(['ADA@example.com'], 'ada@example.com')).toBe(
      true,
    );
    expect(
      isRecipientAccepted([{ address: 'ada@example.com' }], 'ada@example.com'),
    ).toBe(true);
  });

  it('returns false when the recipient is absent', () => {
    expect(isRecipientAccepted(['other@example.com'], 'ada@example.com')).toBe(
      false,
    );
  });
});
