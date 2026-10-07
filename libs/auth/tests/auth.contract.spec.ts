import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import request from 'supertest';
import type { App } from 'supertest/types';
import { StartRegistrationUseCase } from '../application/use-cases/start-registration.use-case';
import { ResendVerificationUseCase } from '../application/use-cases/resend-verification.use-case';
import { CompleteSignUpUseCase } from '../application/use-cases/complete-sign-up.use-case';
import { LoginUseCase } from '../application/use-cases/login.use-case';
import { LogoutUseCase } from '../application/use-cases/logout.use-case';
import { RefreshSessionUseCase } from '../application/use-cases/refresh-session.use-case';
import { RequestPasswordResetUseCase } from '../application/use-cases/request-password-reset.use-case';
import { ConfirmPasswordResetUseCase } from '../application/use-cases/confirm-password-reset.use-case';
import { BeginOAuthUseCase } from '../application/use-cases/begin-oauth.use-case';
import { CompleteOAuthUseCase } from '../application/use-cases/complete-oauth.use-case';
import {
  ActivationCommittedError,
  AuthProviderError,
  EmailAlreadyExistsError,
  InvalidCredentialsError,
  InvalidResetTokenError,
  InvalidSessionError,
  InvalidVerificationTokenError,
  RateLimitedError,
  RegistrationConflictError,
  SourceBlockedError,
  UnsupportedProviderError,
  UnverifiedEmailError,
} from '../application/auth.errors';
import { AuthController } from '../infrastructure/auth.controller';
import { AUTH_CONFIG } from '../infrastructure/auth.config';

type AsyncMock = jest.Mock<(...args: never[]) => Promise<unknown>>;

describe('auth contract', () => {
  let app: INestApplication<App>;
  const startRegistration: AsyncMock = jest.fn();
  const resendVerification: AsyncMock = jest.fn();
  const completeSignUp: AsyncMock = jest.fn();
  const login: AsyncMock = jest.fn();
  const logout: AsyncMock = jest.fn();
  const refresh: AsyncMock = jest.fn();
  const requestReset: AsyncMock = jest.fn();
  const confirmReset: AsyncMock = jest.fn();
  const beginOAuth: AsyncMock = jest.fn();
  const completeOAuth: AsyncMock = jest.fn();

  const config = {
    secret: 'test-secret',
    baseURL: 'http://localhost:3000',
    basePath: '/auth',
    webURL: 'http://localhost:4200',
    trustedOrigins: ['http://localhost:4200', 'http://localhost:3000'],
    allowedProviders: ['google'],
    socialProviders: { google: { clientId: 'id', clientSecret: 'secret' } },
    isProduction: false,
    supportEmail: 'support@example.com',
    smtp: null,
    verificationLimits: {
      resendWindowSeconds: 60,
      sourceWindowSeconds: 3600,
      sourceMax: 20,
      retentionSeconds: 86400,
    },
    trustedProxies: [],
  };

  beforeEach(async () => {
    for (const mock of [
      startRegistration,
      resendVerification,
      completeSignUp,
      login,
      logout,
      refresh,
      requestReset,
      confirmReset,
      beginOAuth,
      completeOAuth,
    ]) {
      mock.mockReset();
    }

    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: StartRegistrationUseCase,
          useValue: { execute: startRegistration },
        },
        {
          provide: ResendVerificationUseCase,
          useValue: { execute: resendVerification },
        },
        {
          provide: CompleteSignUpUseCase,
          useValue: { execute: completeSignUp },
        },
        { provide: LoginUseCase, useValue: { execute: login } },
        { provide: LogoutUseCase, useValue: { execute: logout } },
        { provide: RefreshSessionUseCase, useValue: { execute: refresh } },
        {
          provide: RequestPasswordResetUseCase,
          useValue: { execute: requestReset },
        },
        {
          provide: ConfirmPasswordResetUseCase,
          useValue: { execute: confirmReset },
        },
        { provide: BeginOAuthUseCase, useValue: { execute: beginOAuth } },
        { provide: CompleteOAuthUseCase, useValue: { execute: completeOAuth } },
        { provide: AUTH_CONFIG, useValue: config },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('starts an email-only registration without a session', async () => {
    startRegistration.mockResolvedValue({
      status: 'pending-verification',
      expiresAt: new Date('2026-01-03T00:00:00.000Z'),
      emailStatus: 'accepted',
    });

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'ada@example.com' })
      .expect(201)
      .expect({
        status: 'pending-verification',
        expiresAt: '2026-01-03T00:00:00.000Z',
        emailStatus: 'accepted',
      })
      .expect((response) => {
        expect(response.headers['set-cookie']).toBeUndefined();
      });

    expect(startRegistration).toHaveBeenCalledWith(
      { email: 'ada@example.com' },
      expect.anything(),
    );
  });

  it('rejects signup input that still carries a password', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'ada@example.com', password: 'password123' })
      .expect(400);

    expect(startRegistration).not.toHaveBeenCalled();
  });

  it('maps duplicate signup to conflict', async () => {
    startRegistration.mockRejectedValue(new EmailAlreadyExistsError());

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'ada@example.com' })
      .expect(409);
  });

  it('returns 429 with a retry interval when the signup source is blocked', async () => {
    startRegistration.mockRejectedValue(new SourceBlockedError(30));

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'ada@example.com' })
      .expect(429)
      .expect('Retry-After', '30')
      .expect((response) => {
        expect(response.body).toMatchObject({ statusCode: 429 });
      });
  });

  it('returns a uniform resend acceptance', async () => {
    resendVerification.mockResolvedValue({ status: 'accepted' });

    await request(app.getHttpServer())
      .post('/auth/verification/resend')
      .send({ email: 'ada@example.com' })
      .expect(200)
      .expect({ status: 'accepted' });
  });

  it('activates the account and issues a session cookie', async () => {
    completeSignUp.mockResolvedValue({
      userId: 'user-1',
      status: 'authenticated',
      setCookie: [
        'better-auth.session_token=abc; Path=/; HttpOnly; SameSite=Lax',
      ],
    });

    await request(app.getHttpServer())
      .post('/auth/signup/complete')
      .send({ token: 'token-1', password: 'password123' })
      .expect(200)
      .expect({ userId: 'user-1', status: 'authenticated' })
      .expect((response) => {
        const cookie = response.headers['set-cookie'] as unknown as string[];
        expect(cookie[0]).toContain('better-auth.session_token=abc');
        expect(JSON.stringify(response.body)).not.toContain('abc');
      });
  });

  it('rejects an invalid or expired registration token', async () => {
    completeSignUp.mockRejectedValue(new InvalidVerificationTokenError());

    await request(app.getHttpServer())
      .post('/auth/signup/complete')
      .send({ token: 'expired', password: 'password123' })
      .expect(400);
  });

  it('rejects completion for a concurrently verified identity', async () => {
    completeSignUp.mockRejectedValue(new RegistrationConflictError());

    await request(app.getHttpServer())
      .post('/auth/signup/complete')
      .send({ token: 'token-1', password: 'password123' })
      .expect(409);
  });

  it('reports a committed activation when the session is rate limited', async () => {
    completeSignUp.mockRejectedValue(
      new ActivationCommittedError(new RateLimitedError(9)),
    );

    await request(app.getHttpServer())
      .post('/auth/signup/complete')
      .send({ token: 'token-1', password: 'password123' })
      .expect(429)
      .expect('Retry-After', '9')
      .expect((response) => {
        expect(response.body).toMatchObject({ accountActivated: true });
      });
  });

  it('returns 429 when completion is source-blocked before activation', async () => {
    completeSignUp.mockRejectedValue(new SourceBlockedError(30));

    await request(app.getHttpServer())
      .post('/auth/signup/complete')
      .send({ token: 'token-1', password: 'password123' })
      .expect(429)
      .expect('Retry-After', '30')
      .expect((response) => {
        expect(response.body).toMatchObject({ statusCode: 429 });
        expect(response.body.accountActivated).toBeUndefined();
      });
  });

  it('retires the legacy password-free verification POST', async () => {
    await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ token: 'token-1' })
      .expect(410)
      .expect((response) => {
        expect(response.body).toMatchObject({ statusCode: 410 });
      });
  });

  it('redirects the activation link to the safe password-entry route', async () => {
    await request(app.getHttpServer())
      .get(
        '/auth/verify-email?token=token-1&redirectTo=http://evil.example.com',
      )
      .expect(302)
      .expect(
        'Location',
        'http://localhost:4200/complete-signup?token=token-1',
      );
  });

  it('logs in a verified identity and sets an http-only session cookie', async () => {
    login.mockResolvedValue({
      session: {
        userId: 'user-1',
        email: 'ada@example.com',
        emailVerified: true,
      },
      setCookie: [
        'better-auth.session_token=abc; Path=/; HttpOnly; SameSite=Lax',
      ],
      status: 'authenticated',
    });

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ada@example.com', password: 'password123' })
      .expect(200)
      .expect({ userId: 'user-1', status: 'authenticated' })
      .expect((response) => {
        const cookie = response.headers['set-cookie'] as unknown as string[];
        expect(cookie[0]).toContain('better-auth.session_token=abc');
        expect(cookie[0]).toContain('HttpOnly');
        expect(JSON.stringify(response.body)).not.toContain('abc');
      });
  });

  it('rejects invalid credentials without revealing registration', async () => {
    login.mockRejectedValue(new InvalidCredentialsError());

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ada@example.com', password: 'wrong' })
      .expect(401)
      .expect({
        statusCode: 401,
        message: 'Invalid credentials',
        error: 'Unauthorized',
      });
  });

  it('rejects login for an unverified identity', async () => {
    login.mockRejectedValue(new UnverifiedEmailError());

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ada@example.com', password: 'password123' })
      .expect(401);
  });

  it('does not report a rate-limited login as invalid credentials', async () => {
    login.mockRejectedValue(new RateLimitedError(7));

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ada@example.com', password: 'password123' })
      .expect(429)
      .expect('Retry-After', '7');
  });

  it('revokes the session on logout', async () => {
    logout.mockResolvedValue({
      status: 'ok',
      setCookie: ['better-auth.session_token=; Max-Age=0; Path=/'],
    });

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', 'better-auth.session_token=abc')
      .expect(200)
      .expect({ status: 'ok' })
      .expect((response) => {
        const cookie = response.headers['set-cookie'] as unknown as string[];
        expect(cookie[0]).toContain('Max-Age=0');
      });

    expect(logout).toHaveBeenCalledWith(
      'better-auth.session_token=abc',
      expect.anything(),
    );
  });

  it('renews an active session', async () => {
    refresh.mockResolvedValue({
      userId: 'user-1',
      status: 'authenticated',
      setCookie: ['better-auth.session_token=renewed; Path=/; HttpOnly'],
    });

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', 'better-auth.session_token=abc')
      .expect(200)
      .expect({ userId: 'user-1', status: 'authenticated' });
  });

  it('rejects refresh of an expired or revoked session', async () => {
    refresh.mockRejectedValue(new InvalidSessionError());

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', 'better-auth.session_token=abc')
      .expect(401);
  });

  it('returns 429 with a retry interval when the provider is rate limited', async () => {
    refresh.mockRejectedValue(new RateLimitedError(42));

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', 'better-auth.session_token=abc')
      .expect(429)
      .expect('Retry-After', '42');
  });

  it('returns a service failure, not 401, when the provider fails', async () => {
    refresh.mockRejectedValue(new AuthProviderError('provider down'));

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', 'better-auth.session_token=abc')
      .expect(503);
  });

  it('returns a uniform non-disclosing reset response', async () => {
    requestReset.mockResolvedValue({
      status: 'accepted',
      message:
        'If this email exists in our system, check your email for the reset link',
    });

    await request(app.getHttpServer())
      .post('/auth/reset-password/request')
      .send({ email: 'ada@example.com' })
      .expect(200);
  });

  it('confirms a reset and revokes existing sessions', async () => {
    confirmReset.mockResolvedValue({ status: 'ok' });

    await request(app.getHttpServer())
      .post('/auth/reset-password/confirm')
      .send({ token: 'reset-token', password: 'newpassword123' })
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('rejects an invalid reset token', async () => {
    confirmReset.mockRejectedValue(new InvalidResetTokenError());

    await request(app.getHttpServer())
      .post('/auth/reset-password/confirm')
      .send({ token: 'used', password: 'newpassword123' })
      .expect(400);
  });

  it('starts an OAuth flow and forwards the state cookie to the browser', async () => {
    beginOAuth.mockResolvedValue({
      authorizationUrl: 'https://accounts.google.com/o/oauth2/auth',
      setCookie: ['better-auth.state=abc; Path=/; HttpOnly; Max-Age=300'],
    });

    await request(app.getHttpServer())
      .post('/auth/oauth/google')
      .expect(200)
      .expect({
        provider: 'google',
        authorizationUrl: 'https://accounts.google.com/o/oauth2/auth',
      });
  });

  it('rejects an unsupported OAuth provider', async () => {
    beginOAuth.mockRejectedValue(new UnsupportedProviderError('github'));

    await request(app.getHttpServer()).post('/auth/oauth/github').expect(400);
  });

  it('completes an OAuth callback with a session cookie and redirect', async () => {
    completeOAuth.mockResolvedValue({
      redirectUrl: 'http://localhost:4200/auth/oauth/callback',
      setCookie: ['better-auth.session_token=oauth; Path=/; HttpOnly'],
    });

    await request(app.getHttpServer())
      .get('/auth/callback/google?code=abc&state=xyz')
      .set('Cookie', 'better-auth.state=abc')
      .expect(302)
      .expect('Location', 'http://localhost:4200/auth/oauth/callback')
      .expect((response) => {
        const cookie = response.headers['set-cookie'] as unknown as string[];
        expect(cookie[0]).toContain('better-auth.session_token=oauth');
      });

    expect(completeOAuth).toHaveBeenCalledWith({
      provider: 'google',
      query: { code: 'abc', state: 'xyz' },
      cookieHeader: 'better-auth.state=abc',
      context: expect.anything(),
    });
  });

  it('does not grant a session from OAuth when the email is unverified', async () => {
    completeOAuth.mockRejectedValue(new UnverifiedEmailError());

    await request(app.getHttpServer())
      .get('/auth/callback/google?code=abc&state=xyz')
      .expect(302)
      .expect(
        'Location',
        'http://localhost:4200/auth/oauth/callback?error=email_not_verified',
      );
  });

  it('redirects the reset link to the web app with the token', async () => {
    await request(app.getHttpServer())
      .get('/auth/reset-password/confirm?token=reset-token')
      .expect(302)
      .expect(
        'Location',
        'http://localhost:4200/reset-password?token=reset-token',
      );
  });
});
