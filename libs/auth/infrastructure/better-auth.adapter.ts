import { Inject, Injectable } from '@nestjs/common';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { genericOAuth } from 'better-auth/plugins';
import type {
  AuthProvider,
  AuthenticatedSession,
  CompleteOAuthInput,
  OAuthCallbackResult,
  OAuthStartResult,
  SessionResult,
  SignUpResult,
} from '../application/auth-provider.port';
import type { MailPort } from '../application/mail.port';
import {
  AuthProviderError,
  EmailAlreadyExistsError,
  InvalidCredentialsError,
  InvalidResetTokenError,
  InvalidSessionError,
  InvalidVerificationTokenError,
  UnsupportedProviderError,
  UntrustedRedirectError,
  UnverifiedEmailError,
} from '../application/auth.errors';
import { AuthPrismaService } from './prisma/prisma.service';
import { AUTH_CONFIG, MAIL_PORT, type AuthConfig } from './auth.config';

interface BetterAuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
}

interface SessionPayload {
  session?: { userId: string };
  user?: BetterAuthUser;
}

interface AuthHandler {
  handler(request: Request): Promise<Response>;
}

@Injectable()
export class BetterAuthAdapter implements AuthProvider {
  private readonly auth: AuthHandler;

  constructor(
    @Inject(AuthPrismaService) private readonly prisma: AuthPrismaService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
    @Inject(MAIL_PORT) private readonly mail: MailPort,
  ) {
    this.auth = betterAuth({
      appName: 'auth',
      secret: config.secret,
      baseURL: config.baseURL,
      basePath: config.basePath,
      trustedOrigins: config.trustedOrigins,
      database: prismaAdapter(this.prisma, { provider: 'postgresql' }),
      emailAndPassword: {
        enabled: true,
        autoSignIn: false,
        revokeSessionsOnPasswordReset: true,
        sendResetPassword: async ({ user, url, token }) => {
          const resetToken = token ?? extractResetToken(url);
          await this.mail.send({
            to: user.email,
            subject: 'Reset your password',
            text: `Reset your password by visiting: ${this.buildEmailLink(
              '/auth/reset-password/confirm',
              resetToken,
              `${this.config.webURL}/reset-password`,
            )}`,
          });
        },
      },
      emailVerification: {
        sendOnSignUp: true,
        sendVerificationEmail: async ({ user, url }) => {
          const token = new URL(url).searchParams.get('token') ?? '';
          await this.mail.send({
            to: user.email,
            subject: 'Verify your email',
            text: `Verify your email by visiting: ${this.buildEmailLink(
              '/auth/verify-email',
              token,
              `${this.config.webURL}/verified`,
            )}`,
          });
        },
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
      },
    });
  }

  async signUp(input: {
    email: string;
    password: string;
  }): Promise<SignUpResult> {
    const email = input.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new EmailAlreadyExistsError();
    }

    const response = await this.request('/sign-up/email', {
      method: 'POST',
      body: { email, password: input.password, name: email.split('@')[0] },
    });
    const data = await this.readJson<{ user?: { id: string } }>(response);

    if (response.status >= 400 || !data?.user) {
      if (response.status === 409 || response.status === 422) {
        throw new EmailAlreadyExistsError();
      }
      throw new AuthProviderError(`Sign up failed (${response.status})`);
    }

    return { userId: data.user.id };
  }

  async verifyEmail(token: string): Promise<void> {
    const response = await this.request('/verify-email', {
      method: 'GET',
      query: { token },
    });

    if (response.status >= 400) {
      throw new InvalidVerificationTokenError();
    }
  }

  async login(input: {
    email: string;
    password: string;
  }): Promise<SessionResult> {
    const response = await this.request('/sign-in/email', {
      method: 'POST',
      body: { email: input.email, password: input.password },
    });
    const setCookie = response.headers.getSetCookie();

    if (response.status >= 400) {
      throw new InvalidCredentialsError();
    }

    const data = await this.readJson<{ user?: BetterAuthUser }>(response);
    if (!data?.user) {
      throw new InvalidCredentialsError();
    }

    if (!data.user.emailVerified) {
      await this.logout(toCookieHeader(setCookie));
      throw new UnverifiedEmailError();
    }

    return { session: toSession(data.user), setCookie };
  }

  async logout(cookieHeader: string | undefined): Promise<string[]> {
    const response = await this.request('/sign-out', {
      method: 'POST',
      cookie: cookieHeader,
    });

    return response.headers.getSetCookie();
  }

  async refresh(cookieHeader: string | undefined): Promise<SessionResult> {
    const session = await this.loadSession(cookieHeader);
    if (!session) {
      throw new InvalidSessionError();
    }

    const response = await this.request('/get-session', {
      method: 'GET',
      cookie: cookieHeader,
    });

    return { session, setCookie: response.headers.getSetCookie() };
  }

  async requestPasswordReset(email: string): Promise<void> {
    await this.request('/request-password-reset', {
      method: 'POST',
      body: {
        email: email.toLowerCase(),
        redirectTo: `${this.config.webURL}/reset-password`,
      },
    });
  }

  async confirmPasswordReset(input: {
    token: string;
    password: string;
  }): Promise<void> {
    const response = await this.request('/reset-password', {
      method: 'POST',
      body: { token: input.token, newPassword: input.password },
    });

    if (response.status >= 400) {
      throw new InvalidResetTokenError();
    }
  }

  async getSession(
    cookieHeader: string | undefined,
  ): Promise<AuthenticatedSession | null> {
    return this.loadSession(cookieHeader);
  }

  async startOAuth(input: {
    provider: string;
    callbackURL: string;
  }): Promise<OAuthStartResult> {
    const response = await this.request('/sign-in/social', {
      method: 'POST',
      body: {
        provider: input.provider,
        callbackURL: input.callbackURL,
        errorCallbackURL: input.callbackURL,
        disableRedirect: true,
      },
    });
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
    const session = cookieHeader ? await this.loadSession(cookieHeader) : null;

    if (!session) {
      throw new AuthProviderError('OAuth callback did not establish a session');
    }

    if (!session.emailVerified) {
      await this.logout(cookieHeader);
      throw new UnverifiedEmailError();
    }

    return { redirectUrl: location, setCookie };
  }

  private async loadSession(
    cookieHeader: string | undefined,
  ): Promise<AuthenticatedSession | null> {
    if (!cookieHeader) {
      return null;
    }

    const response = await this.request('/get-session', {
      method: 'GET',
      cookie: cookieHeader,
    });
    const data = await this.readJson<SessionPayload>(response);

    if (!data?.user || !data.session) {
      return null;
    }

    return toSession(data.user);
  }

  private async request(
    path: string,
    options: {
      method: string;
      body?: unknown;
      query?: Record<string, string>;
      cookie?: string;
    },
  ): Promise<Response> {
    const url = new URL(`${this.config.basePath}${path}`, this.config.baseURL);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      url.searchParams.set(key, value);
    }

    const headers = new Headers({ origin: this.config.baseURL });
    if (options.cookie) {
      headers.set('cookie', options.cookie);
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

  private buildEmailLink(
    path: string,
    token: string,
    redirectTo: string,
  ): string {
    const url = new URL(path, this.config.baseURL);
    url.searchParams.set('token', token);
    url.searchParams.set('redirectTo', redirectTo);

    return url.toString();
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
