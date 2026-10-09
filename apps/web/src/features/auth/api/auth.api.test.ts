import { describe, expect, it } from 'vitest';
import {
  accountSummaryResponseSchema,
  changePasswordResponseSchema,
  loginResponseSchema,
  logoutResponseSchema,
  passwordResetRequestResponseSchema,
  publicConfigResponseSchema,
  resendVerificationResponseSchema,
  signupResponseSchema,
} from './auth.api';

describe('auth response schemas', () => {
  it('accepts a valid login response and rejects a non-authenticated status', () => {
    expect(
      loginResponseSchema.parse({ userId: 'u1', status: 'authenticated' }),
    ).toEqual({ userId: 'u1', status: 'authenticated' });
    expect(() =>
      loginResponseSchema.parse({
        userId: 'u1',
        status: 'pending-verification',
      }),
    ).toThrow();
  });

  it('accepts an email-only pending signup response without a userId', () => {
    expect(
      signupResponseSchema.parse({
        status: 'pending-verification',
        expiresAt: '2026-01-03T00:00:00.000Z',
        emailStatus: 'accepted',
      }),
    ).toMatchObject({ emailStatus: 'accepted' });

    expect(() =>
      signupResponseSchema.parse({
        userId: 'u1',
        status: 'pending-verification',
      }),
    ).toThrow();
  });

  it('accepts an optional retry interval on signup and resend', () => {
    expect(
      signupResponseSchema.parse({
        status: 'pending-verification',
        expiresAt: '2026-01-03T00:00:00.000Z',
        emailStatus: 'throttled',
        retryAfterSeconds: 30,
      }),
    ).toMatchObject({ emailStatus: 'throttled', retryAfterSeconds: 30 });

    expect(
      resendVerificationResponseSchema.parse({
        status: 'accepted',
        retryAfterSeconds: 15,
      }),
    ).toEqual({ status: 'accepted', retryAfterSeconds: 15 });
  });

  it('accepts a nullable or configured support email', () => {
    expect(
      publicConfigResponseSchema.parse({ supportEmail: 'help@example.com' }),
    ).toEqual({ supportEmail: 'help@example.com' });
    expect(publicConfigResponseSchema.parse({ supportEmail: null })).toEqual({
      supportEmail: null,
    });
  });

  it('accepts the uniform reset-request response', () => {
    expect(
      passwordResetRequestResponseSchema.parse({
        status: 'accepted',
        message: 'If the email exists, a reset link was sent',
      }),
    ).toMatchObject({ status: 'accepted' });
  });

  it('accepts the logout response', () => {
    expect(logoutResponseSchema.parse({ status: 'ok' })).toEqual({
      status: 'ok',
    });
  });

  it('accepts an account summary with or without a password credential', () => {
    expect(
      accountSummaryResponseSchema.parse({
        email: 'ada@example.com',
        hasPassword: true,
        passwordUpdatedAt: '2026-01-02T03:04:05.000Z',
      }),
    ).toEqual({
      email: 'ada@example.com',
      hasPassword: true,
      passwordUpdatedAt: '2026-01-02T03:04:05.000Z',
    });

    expect(
      accountSummaryResponseSchema.parse({
        email: 'ada@example.com',
        hasPassword: false,
        passwordUpdatedAt: null,
      }),
    ).toEqual({
      email: 'ada@example.com',
      hasPassword: false,
      passwordUpdatedAt: null,
    });

    expect(() =>
      accountSummaryResponseSchema.parse({
        email: 'ada@example.com',
        hasPassword: true,
      }),
    ).toThrow();
  });

  it('accepts the change-password response', () => {
    expect(changePasswordResponseSchema.parse({ status: 'ok' })).toEqual({
      status: 'ok',
    });
    expect(() => changePasswordResponseSchema.parse({})).toThrow();
  });
});
