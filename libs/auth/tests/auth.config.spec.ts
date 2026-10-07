import { describe, expect, it } from '@jest/globals';
import { loadAuthConfig } from '../infrastructure/auth.config';

const baseEnv: NodeJS.ProcessEnv = {
  AUTH_SECRET: 'test-secret',
};

describe('loadAuthConfig', () => {
  it('starts without SMTP in development', () => {
    const config = loadAuthConfig({ ...baseEnv });

    expect(config.isProduction).toBe(false);
    expect(config.smtp).toBeNull();
    expect(config.supportEmail).toBeNull();
  });

  it('loads valid SMTP configuration', () => {
    const config = loadAuthConfig({
      ...baseEnv,
      SMTP_HOST: 'mailpit',
      SMTP_PORT: '1025',
      MAIL_FROM: 'no-reply@example.com',
      SMTP_USER: 'user',
      SMTP_PASSWORD: 'secret',
    });

    expect(config.smtp).toEqual({
      host: 'mailpit',
      port: 1025,
      secure: false,
      user: 'user',
      password: 'secret',
      from: 'no-reply@example.com',
    });
  });

  it('marks port 465 as secure', () => {
    const config = loadAuthConfig({
      ...baseEnv,
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '465',
      MAIL_FROM: 'no-reply@example.com',
    });

    expect(config.smtp?.secure).toBe(true);
  });

  it('rejects a syntactically invalid MAIL_FROM', () => {
    expect(() =>
      loadAuthConfig({
        ...baseEnv,
        SMTP_HOST: 'mailpit',
        MAIL_FROM: 'not-an-email',
      }),
    ).toThrow('MAIL_FROM must be a valid email address');
  });

  it('rejects a non-numeric SMTP port', () => {
    expect(() =>
      loadAuthConfig({
        ...baseEnv,
        SMTP_HOST: 'mailpit',
        SMTP_PORT: 'abc',
      }),
    ).toThrow('SMTP_PORT must be a positive integer');
  });

  it('requires SMTP configuration in production', () => {
    expect(() =>
      loadAuthConfig({
        ...baseEnv,
        NODE_ENV: 'production',
        AUTH_SUPPORT_EMAIL: 'support@example.com',
      }),
    ).toThrow('SMTP_HOST must be configured in production');
  });

  it('requires a support email in production', () => {
    expect(() =>
      loadAuthConfig({
        ...baseEnv,
        NODE_ENV: 'production',
        SMTP_HOST: 'smtp.example.com',
        MAIL_FROM: 'no-reply@example.com',
      }),
    ).toThrow('AUTH_SUPPORT_EMAIL must be configured in production');
  });

  it('rejects an invalid support email', () => {
    expect(() =>
      loadAuthConfig({
        ...baseEnv,
        AUTH_SUPPORT_EMAIL: 'invalid',
      }),
    ).toThrow('AUTH_SUPPORT_EMAIL must be a valid email address');
  });

  it('parses configured trusted proxies', () => {
    const config = loadAuthConfig({
      ...baseEnv,
      AUTH_TRUSTED_PROXIES: '10.0.0.0/8, 127.0.0.1',
    });

    expect(config.trustedProxies).toEqual(['10.0.0.0/8', '127.0.0.1']);
  });

  it('defaults trusted proxies to an empty list', () => {
    expect(loadAuthConfig({ ...baseEnv }).trustedProxies).toEqual([]);
  });

  it('uses verification limit defaults', () => {
    const config = loadAuthConfig({ ...baseEnv });

    expect(config.verificationLimits).toEqual({
      resendWindowSeconds: 60,
      sourceWindowSeconds: 3600,
      sourceMax: 20,
      retentionSeconds: 86400,
    });
  });

  it('rejects a non-positive source maximum', () => {
    expect(() =>
      loadAuthConfig({
        ...baseEnv,
        AUTH_VERIFICATION_SOURCE_MAX: '0',
      }),
    ).toThrow('AUTH_VERIFICATION_SOURCE_MAX must be a positive integer');
  });

  it('rejects retention shorter than the longest window', () => {
    expect(() =>
      loadAuthConfig({
        ...baseEnv,
        AUTH_VERIFICATION_SOURCE_WINDOW_SECONDS: '7200',
        AUTH_VERIFICATION_THROTTLE_RETENTION_SECONDS: '3600',
      }),
    ).toThrow(
      'AUTH_VERIFICATION_THROTTLE_RETENTION_SECONDS must be at least the longest configured verification window',
    );
  });
});
