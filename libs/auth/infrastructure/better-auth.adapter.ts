import { Inject, Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { genericOAuth } from 'better-auth/plugins';
import type {
  AuthProvider,
  AuthenticatedSession,
  ChangePasswordInput,
  CompleteOAuthInput,
  OAuthCallbackResult,
  OAuthStartResult,
  SessionResult,
} from '../application/auth-provider.port';
import type { MailPort } from '../application/mail.port';
import type { RequestContext } from '../application/request-context';
import {
  AuthProviderError,
  InvalidCredentialsError,
  InvalidPasswordError,
  InvalidResetTokenError,
  InvalidSessionError,
  NoPasswordCredentialError,
  RateLimitedError,
  UnsupportedProviderError,
  UntrustedRedirectError,
  UnverifiedEmailError,
} from '../application/auth.errors';
import { AuthPrismaService } from './prisma/prisma.service';
import { AUTH_CONFIG, MAIL_PORT, type AuthConfig } from './auth.config';

const INTERNAL_IP_HEADER = 'x-auth-client-ip';

export const AUTH_HANDLER = Symbol('AUTH_HANDLER');

interface BetterAuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
}

interface SessionPayload {
  session?: { userId: string };
  user?: BetterAuthUser;
}

export interface BetterAuthHandler {
  handler(request: Request): Promise<Response>;
}

function buildEmailLink(
  baseURL: string,
  path: string,
  token: string,
  redirectTo: string,
): string {
  const url = new URL(path, baseURL);
  url.searchParams.set('token', token);
  url.searchParams.set('redirectTo', redirectTo);
  return url.toString();
}

export function createBetterAuthHandler(
  prisma: AuthPrismaService,
  config: AuthConfig,
  mail: MailPort,
): BetterAuthHandler {
  return betterAuth({
    appName: 'auth',
    secret: config.secret,
    baseURL: config.baseURL,
    basePath: config.basePath,
    trustedOrigins: config.trustedOrigins,
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url, token }) => {
        const resetToken = token ?? extractResetToken(url);
        await mail.send({
          to: user.email,
          subject: 'Reset your password',
          text: `Reset your password by visiting: ${buildEmailLink(
            config.baseURL,
            '/auth/reset-password/confirm',
            resetToken,
            `${config.webURL}/reset-password`,
          )}`,
        });
      },
    },
    emailVerification: {
      autoSignInAfterVerification: false,
    },
    socialProviders: config.socialProviders,
    plugins: config.testOAuthProvider
      ? [
          genericOAuth({
            config: [
              {
                providerId: config.testOAuthProvider.providerId,
                clientId: config.testOAuthProvider.clientId,
                clientSecret: config.testOAuthProvider.clientSecret,
                authorizationUrl: config.testOAuthProvider.authorizationUrl,
                tokenUrl: config.testOAuthProvider.tokenUrl,
                userInfoUrl: config.testOAuthProvider.userInfoUrl,
                scopes: config.testOAuthProvider.scopes,
              },
            ],
          }),
        ]
      : [],
    advanced: {
      useSecureCookies: process.env.NODE_ENV === 'production',
      database: {
        generateId: () => randomUUID(),
      },
      ipAddress: {
        ipAddressHeaders: [INTERNAL_IP_HEADER],
      },
    },
  });
}

@Injectable()
export class BetterAuthAdapter implements AuthProvider {
  private readonly auth: BetterAuthHandler;

  constructor(
    @Inject(AuthPrismaService) prisma: AuthPrismaService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
    @Inject(MAIL_PORT) mail: MailPort,
    @Optional()
    @Inject(AUTH_HANDLER)
    handler?: BetterAuthHandler,
  ) {
    this.auth = handler ?? createBetterAuthHandler(prisma, config, mail);
  }

  async login(
    input: {
      email: string;
      password: string;
    },
    context: RequestContext,
  ): Promise<SessionResult> {
    const response = await this.request(
      '/sign-in/email',
      {
        method: 'POST',
        body: { email: input.email, password: input.password },
      },
      context,
    );
    const setCookie = response.headers.getSetCookie();
    this.assertProviderAvailable(response);

    if (response.status >= 400) {
      throw new InvalidCredentialsError();
    }

    const data = await this.readJson<{ user?: BetterAuthUser }>(response);
    if (!data?.user) {
      throw new InvalidCredentialsError();
    }

    if (!data.user.emailVerified) {
      await this.logout(toCookieHeader(setCookie), context);
      throw new UnverifiedEmailError();
    }

    return { session: toSession(data.user), setCookie };
  }

  async logout(
    cookieHeader: string | undefined,
    context: RequestContext,
  ): Promise<string[]> {
    const response = await this.request(
      '/sign-out',
      {
        method: 'POST',
        cookie: cookieHeader,
      },
      context,
    );

    return response.headers.getSetCookie();
  }

  async refresh(
    cookieHeader: string | undefined,
    context: RequestContext,
  ): Promise<SessionResult> {
    const response = await this.request(
      '/get-session',
      {
        method: 'GET',
        cookie: cookieHeader,
      },
      context,
    );
    this.assertProviderAvailable(response);

    const data = await this.readJson<SessionPayload>(response);
    if (
      response.status >= 400 ||
      !data?.user ||
      !data.session ||
      !data.user.emailVerified
    ) {
      throw new InvalidSessionError();
    }

    return {
      session: toSession(data.user),
      setCookie: response.headers.getSetCookie(),
    };
  }

  async requestPasswordReset(
    email: string,
    context: RequestContext,
  ): Promise<void> {
    await this.request(
      '/request-password-reset',
      {
        method: 'POST',
        body: {
          email: email.toLowerCase(),
          redirectTo: `${this.config.webURL}/reset-password`,
        },
      },
      context,
    );
  }

  async confirmPasswordReset(
    input: {
      token: string;
      password: string;
    },
    context: RequestContext,
  ): Promise<void> {
    const response = await this.request(
      '/reset-password',
      {
        method: 'POST',
        body: { token: input.token, newPassword: input.password },
      },
      context,
    );

    if (response.status >= 400) {
      throw new InvalidResetTokenError();
    }
  }

  async getSession(
    cookieHeader: string | undefined,
    context: RequestContext,
  ): Promise<AuthenticatedSession | null> {
    const session = await this.loadSession(cookieHeader, context);
    if (!session || !session.emailVerified) {
      return null;
    }

    return session;
  }

  async changePassword(
    input: ChangePasswordInput,
    context: RequestContext,
  ): Promise<string[]> {
    const response = await this.request(
      '/change-password',
      {
        method: 'POST',
        body: {
          currentPassword: input.currentPassword,
          newPassword: input.newPassword,
          revokeOtherSessions: true,
        },
        cookie: input.cookieHeader,
      },
      context,
    );
    this.assertProviderAvailable(response);

    if (response.status === 401) {
      throw new InvalidSessionError();
    }

    if (response.status >= 400) {
      const data = await this.readJson<{ code?: string }>(response);
      if (data?.code === 'INVALID_PASSWORD') {
        throw new InvalidPasswordError('Current password is incorrect');
      }

      if (data?.code === 'CREDENTIAL_ACCOUNT_NOT_FOUND') {
        throw new NoPasswordCredentialError();
      }

      throw new AuthProviderError(
        `Auth provider failed with status ${response.status}`,
      );
    }

    // Better Auth revoked every session and issued a fresh one for the caller;
    // return the replacement cookie so the browser stays signed in on a rotated
    // session while every other device is signed out.
    return response.headers.getSetCookie();
  }

  async startOAuth(
    input: {
      provider: string;
      callbackURL: string;
    },
    context: RequestContext,
  ): Promise<OAuthStartResult> {
    const response = await this.request(
      '/sign-in/social',
      {
        method: 'POST',
        body: {
          provider: input.provider,
          callbackURL: input.callbackURL,
          errorCallbackURL: input.callbackURL,
          disableRedirect: true,
        },
      },
      context,
    );
    const data = await this.readJson<{ url?: string }>(response);

    if (response.status >= 400 || !data?.url) {
      throw new UnsupportedProviderError(input.provider);
    }

    return {
      authorizationUrl: data.url,
      setCookie: response.headers.getSetCookie(),
    };
  }

  async completeOAuth(input: CompleteOAuthInput): Promise<OAuthCallbackResult> {
    const response = await this.request(
      `/callback/${encodeURIComponent(input.provider)}`,
      {
        method: 'GET',
        query: input.query,
        cookie: input.cookieHeader,
      },
      input.context,
    );
    const location = response.headers.get('location');

    if (response.status >= 400 || !location) {
      throw new AuthProviderError('OAuth callback failed');
    }

    if (!this.isTrustedOrigin(location)) {
      throw new UntrustedRedirectError();
    }

    const setCookie = response.headers.getSetCookie();
    const cookieHeader = toCookieHeader(setCookie);
    const session = cookieHeader
      ? await this.loadSession(cookieHeader, input.context)
      : null;

    if (!session) {
      throw new AuthProviderError('OAuth callback did not establish a session');
    }

    if (!session.emailVerified) {
      await this.logout(cookieHeader, input.context);
      throw new UnverifiedEmailError();
    }

    return { redirectUrl: location, setCookie };
  }

  private async loadSession(
    cookieHeader: string | undefined,
    context: RequestContext,
  ): Promise<AuthenticatedSession | null> {
    if (!cookieHeader) {
      return null;
    }

    const response = await this.request(
      '/get-session',
      {
        method: 'GET',
        cookie: cookieHeader,
      },
      context,
    );
    this.assertProviderAvailable(response);

    const data = await this.readJson<SessionPayload>(response);

    if (response.status >= 400 || !data?.user || !data.session) {
      return null;
    }

    return toSession(data.user);
  }

  private assertProviderAvailable(response: Response): void {
    if (response.status === 429) {
      const retryAfter =
        response.headers.get('x-retry-after') ??
        response.headers.get('retry-after');
      const seconds = retryAfter ? Number.parseInt(retryAfter, 10) : Number.NaN;
      throw new RateLimitedError(Number.isFinite(seconds) ? seconds : 60);
    }

    if (response.status >= 500) {
      throw new AuthProviderError(
        `Auth provider failed with status ${response.status}`,
      );
    }
  }

  private async request(
    path: string,
    options: {
      method: string;
      body?: unknown;
      query?: Record<string, string>;
      cookie?: string;
    },
    context: RequestContext | undefined,
  ): Promise<Response> {
    const url = new URL(`${this.config.basePath}${path}`, this.config.baseURL);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      url.searchParams.set(key, value);
    }

    const headers = new Headers({ origin: this.config.baseURL });
    if (options.cookie) {
      headers.set('cookie', options.cookie);
    }
    if (context?.sourceIp) {
      headers.set(INTERNAL_IP_HEADER, context.sourceIp);
    }

    let body: string | undefined;
    if (options.body !== undefined) {
      headers.set('content-type', 'application/json');
      body = JSON.stringify(options.body);
    }

    return this.auth.handler(
      new Request(url.toString(), { method: options.method, headers, body }),
    );
  }

  private async readJson<T>(response: Response): Promise<T | null> {
    const text = await response.text();
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }

  private isTrustedOrigin(location: string): boolean {
    try {
      return this.config.trustedOrigins.includes(new URL(location).origin);
    } catch {
      return false;
    }
  }
}

function toSession(user: BetterAuthUser): AuthenticatedSession {
  return {
    userId: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
  };
}

function toCookieHeader(setCookie: string[]): string | undefined {
  const pairs = setCookie
    .map((cookie) => cookie.split(';', 1)[0])
    .filter((pair) => pair.length > 0);

  return pairs.length > 0 ? pairs.join('; ') : undefined;
}

function extractResetToken(url: string): string {
  const segments = new URL(url).pathname.split('/').filter(Boolean);
  return decodeURIComponent(segments.at(-1) ?? '');
}
