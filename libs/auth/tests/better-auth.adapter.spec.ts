/* eslint-disable @typescript-eslint/require-await */
import { describe, expect, it } from '@jest/globals';
import {
  BetterAuthAdapter,
  type BetterAuthHandler,
} from '../infrastructure/better-auth.adapter';
import {
  AuthProviderError,
  InvalidCredentialsError,
  InvalidPasswordError,
  InvalidSessionError,
  NoPasswordCredentialError,
  RateLimitedError,
} from '../application/auth.errors';
import type { AuthConfig } from '../infrastructure/auth.config';

const CONFIG: AuthConfig = {
  secret: 'secret',
  baseURL: 'http://localhost:3000',
  webURL: 'http://localhost:4200',
  basePath: '/auth',
  trustedOrigins: ['http://localhost:4200'],
  allowedProviders: [],
  socialProviders: {},
  isProduction: false,
  supportEmail: null,
  smtp: null,
  verificationLimits: {
    resendWindowSeconds: 60,
    sourceWindowSeconds: 3600,
    sourceMax: 20,
    retentionSeconds: 86400,
  },
  trustedProxies: [],
};

const CONTEXT = { sourceIp: '203.0.113.1' };

function handlerReturning(
  resolve: (path: string, request: Request) => Response,
): BetterAuthHandler {
  return {
    handler: async (request: Request) => {
      return resolve(new URL(request.url).pathname, request);
    },
  };
}

function adapterWith(handler: BetterAuthHandler): BetterAuthAdapter {
  return new BetterAuthAdapter(
    {} as never,
    CONFIG,
    { send: async () => undefined },
    handler,
  );
}

function sessionResponse(user: {
  id: string;
  email: string;
  emailVerified: boolean;
}): Response {
  return new Response(JSON.stringify({ session: { userId: user.id }, user }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('BetterAuthAdapter session classification', () => {
  it('returns null for a genuine absent session (401)', async () => {
    const adapter = adapterWith(
      handlerReturning(() => new Response(null, { status: 401 })),
    );

    await expect(adapter.getSession('cookie', CONTEXT)).resolves.toBeNull();
  });

  it('returns null for an unverified session', async () => {
    const adapter = adapterWith(
      handlerReturning(() =>
        sessionResponse({
          id: 'user-1',
          email: 'ada@example.com',
          emailVerified: false,
        }),
      ),
    );

    await expect(adapter.getSession('cookie', CONTEXT)).resolves.toBeNull();
  });

  it('surfaces a provider rate limit with its retry interval', async () => {
    const adapter = adapterWith(
      handlerReturning(
        () =>
          new Response(null, {
            status: 429,
            headers: { 'x-retry-after': '30' },
          }),
      ),
    );

    const error = await adapter
      .getSession('cookie', CONTEXT)
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(RateLimitedError);
    expect((error as RateLimitedError).retryAfterSeconds).toBe(30);
  });

  it('surfaces a provider service failure as a non-401 error', async () => {
    const adapter = adapterWith(
      handlerReturning(() => new Response(null, { status: 503 })),
    );

    await expect(adapter.getSession('cookie', CONTEXT)).rejects.toBeInstanceOf(
      AuthProviderError,
    );
  });

  it('returns a verified session', async () => {
    const adapter = adapterWith(
      handlerReturning(() =>
        sessionResponse({
          id: 'user-1',
          email: 'ada@example.com',
          emailVerified: true,
        }),
      ),
    );

    await expect(adapter.getSession('cookie', CONTEXT)).resolves.toEqual({
      userId: 'user-1',
      email: 'ada@example.com',
      emailVerified: true,
    });
  });
});

describe('BetterAuthAdapter login/refresh classification', () => {
  it('rejects invalid credentials as non-disclosing invalid credentials', async () => {
    const adapter = adapterWith(
      handlerReturning(() => new Response(null, { status: 401 })),
    );

    await expect(
      adapter.login({ email: 'ada@example.com', password: 'x' }, CONTEXT),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('does not map a login rate limit to invalid credentials', async () => {
    const adapter = adapterWith(
      handlerReturning(
        () =>
          new Response(null, {
            status: 429,
            headers: { 'retry-after': '12' },
          }),
      ),
    );

    await expect(
      adapter.login({ email: 'ada@example.com', password: 'x' }, CONTEXT),
    ).rejects.toBeInstanceOf(RateLimitedError);
  });

  it('does not map a login service failure to invalid credentials', async () => {
    const adapter = adapterWith(
      handlerReturning(() => new Response(null, { status: 500 })),
    );

    await expect(
      adapter.login({ email: 'ada@example.com', password: 'x' }, CONTEXT),
    ).rejects.toBeInstanceOf(AuthProviderError);
  });

  it('rejects a refresh service failure as non-401', async () => {
    const adapter = adapterWith(
      handlerReturning(() => new Response(null, { status: 502 })),
    );

    await expect(adapter.refresh('cookie', CONTEXT)).rejects.toBeInstanceOf(
      AuthProviderError,
    );
  });

  it('rejects an expired refresh as invalid session', async () => {
    const adapter = adapterWith(
      handlerReturning(() => new Response(null, { status: 401 })),
    );

    await expect(adapter.refresh('cookie', CONTEXT)).rejects.toBeInstanceOf(
      InvalidSessionError,
    );
  });
});

describe('BetterAuthAdapter changePassword', () => {
  const INPUT = {
    cookieHeader: 'better-auth.session_token=old',
    currentPassword: 'Current!Pass1',
    newPassword: 'New!Passphrase2',
  };

  function changePasswordHandler(
    changeResponse: () => Response,
  ): BetterAuthHandler {
    return {
      handler: () => Promise.resolve(changeResponse()),
    };
  }

  it('returns the replacement session cookie that keeps the caller signed in', async () => {
    const requests: string[] = [];
    const handler: BetterAuthHandler = {
      handler: async (request: Request) => {
        requests.push(new URL(request.url).pathname);
        expect(request.headers.get('cookie')).toBe(INPUT.cookieHeader);
        const body = (await request.json()) as Record<string, unknown>;
        expect(body).toEqual({
          currentPassword: INPUT.currentPassword,
          newPassword: INPUT.newPassword,
          revokeOtherSessions: true,
        });

        return new Response(JSON.stringify({ token: 'replacement' }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'set-cookie':
              'better-auth.session_token=replacement; Path=/; HttpOnly',
          },
        });
      },
    };
    const adapter = adapterWith(handler);

    await expect(adapter.changePassword(INPUT, CONTEXT)).resolves.toEqual([
      'better-auth.session_token=replacement; Path=/; HttpOnly',
    ]);
    expect(requests).toEqual(['/auth/change-password']);
  });

  it('maps a wrong current password to InvalidPasswordError', async () => {
    const adapter = adapterWith(
      changePasswordHandler(
        () =>
          new Response(
            JSON.stringify({ code: 'INVALID_PASSWORD', message: 'nope' }),
            { status: 400, headers: { 'content-type': 'application/json' } },
          ),
      ),
    );

    await expect(adapter.changePassword(INPUT, CONTEXT)).rejects.toBeInstanceOf(
      InvalidPasswordError,
    );
  });

  it('maps a missing credential account to NoPasswordCredentialError', async () => {
    const adapter = adapterWith(
      changePasswordHandler(
        () =>
          new Response(
            JSON.stringify({
              code: 'CREDENTIAL_ACCOUNT_NOT_FOUND',
              message: 'no credential',
            }),
            { status: 400, headers: { 'content-type': 'application/json' } },
          ),
      ),
    );

    await expect(adapter.changePassword(INPUT, CONTEXT)).rejects.toBeInstanceOf(
      NoPasswordCredentialError,
    );
  });

  it('maps an unauthenticated change to InvalidSessionError', async () => {
    const adapter = adapterWith(
      changePasswordHandler(() => new Response(null, { status: 401 })),
    );

    await expect(adapter.changePassword(INPUT, CONTEXT)).rejects.toBeInstanceOf(
      InvalidSessionError,
    );
  });

  it('maps a rate-limited change to RateLimitedError', async () => {
    const adapter = adapterWith(
      changePasswordHandler(
        () =>
          new Response(null, {
            status: 429,
            headers: { 'x-retry-after': '15' },
          }),
      ),
    );

    await expect(adapter.changePassword(INPUT, CONTEXT)).rejects.toBeInstanceOf(
      RateLimitedError,
    );
  });

  it('maps a change service failure to AuthProviderError', async () => {
    const adapter = adapterWith(
      changePasswordHandler(() => new Response(null, { status: 500 })),
    );

    await expect(adapter.changePassword(INPUT, CONTEXT)).rejects.toBeInstanceOf(
      AuthProviderError,
    );
  });
});
