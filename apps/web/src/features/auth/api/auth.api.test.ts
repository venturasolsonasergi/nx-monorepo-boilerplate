import { describe, expect, it } from 'vitest';
import {
  loginResponseSchema,
  logoutResponseSchema,
  passwordResetRequestResponseSchema,
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

  it('accepts a pending-verification signup response', () => {
    expect(
      signupResponseSchema.parse({
        userId: 'u1',
        status: 'pending-verification',
      }),
    ).toEqual({ userId: 'u1', status: 'pending-verification' });
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
});
