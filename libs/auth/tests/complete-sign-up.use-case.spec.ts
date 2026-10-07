/* eslint-disable @typescript-eslint/require-await */
import { describe, expect, it, jest } from '@jest/globals';
import { CompleteSignUpUseCase } from '../application/use-cases/complete-sign-up.use-case';
import type { AuthProvider } from '../application/auth-provider.port';
import type { VerificationRateLimitService } from '../application/verification-rate-limit.service';
import type { Clock } from '../application/clock.port';
import {
  ActivationCommittedError,
  InvalidPasswordError,
  InvalidVerificationTokenError,
  RateLimitedError,
  SourceBlockedError,
} from '../application/auth.errors';

const CLOCK: Clock = { now: () => new Date('2026-01-01T00:00:00.000Z') };
const CONTEXT = { sourceIp: '203.0.113.9' };

function build(options: {
  allowed?: boolean;
  activation?: () => Promise<{ userId: string; email: string }>;
  login?: () => Promise<unknown>;
}) {
  const activate = jest.fn(
    options.activation ??
      (async () => ({ userId: 'user-1', email: 'ada@example.com' })),
  );
  const login = jest.fn(
    options.login ??
      (async () => ({
        session: {
          userId: 'user-1',
          email: 'ada@example.com',
          emailVerified: true,
        },
        setCookie: ['better-auth.session_token=abc'],
      })),
  );
  const reserveSource = jest.fn(async () => ({
    allowed: options.allowed ?? true,
    retryAfterSeconds: (options.allowed ?? true) ? 0 : 15,
    reason: (options.allowed ?? true) ? null : ('source' as const),
  }));

  const activation = { activate };
  const provider = { login } as unknown as AuthProvider;
  const rateLimit = {
    reserveSource,
  } as unknown as VerificationRateLimitService;

  return {
    useCase: new CompleteSignUpUseCase(activation, provider, rateLimit, CLOCK),
    activate,
    login,
    reserveSource,
  };
}

describe('CompleteSignUpUseCase', () => {
  it('activates, issues a session, and returns the authenticated result', async () => {
    const { useCase } = build({});

    await expect(
      useCase.execute({ token: 'token-1', password: 'password123' }, CONTEXT),
    ).resolves.toEqual({
      userId: 'user-1',
      status: 'authenticated',
      setCookie: ['better-auth.session_token=abc'],
    });
  });

  it('rejects an over-long password before consuming the token', async () => {
    const { useCase, activate, reserveSource } = build({});

    await expect(
      useCase.execute({ token: 'token-1', password: 'a'.repeat(129) }, CONTEXT),
    ).rejects.toBeInstanceOf(InvalidPasswordError);

    expect(activate).not.toHaveBeenCalled();
    expect(reserveSource).not.toHaveBeenCalled();
  });

  it('rate-limits completion by source before hashing', async () => {
    const { useCase, activate } = build({ allowed: false });

    await expect(
      useCase.execute({ token: 'token-1', password: 'password123' }, CONTEXT),
    ).rejects.toBeInstanceOf(SourceBlockedError);

    expect(activate).not.toHaveBeenCalled();
  });

  it('does not issue a session when the token is invalid', async () => {
    const { useCase, login } = build({
      activation: async () => {
        throw new InvalidVerificationTokenError();
      },
    });

    await expect(
      useCase.execute({ token: 'expired', password: 'password123' }, CONTEXT),
    ).rejects.toBeInstanceOf(InvalidVerificationTokenError);

    expect(login).not.toHaveBeenCalled();
  });

  it('reports committed activation when session issuance fails', async () => {
    const { useCase } = build({
      login: async () => {
        throw new RateLimitedError(9);
      },
    });

    await expect(
      useCase.execute({ token: 'token-1', password: 'password123' }, CONTEXT),
    ).rejects.toBeInstanceOf(ActivationCommittedError);
  });
});
