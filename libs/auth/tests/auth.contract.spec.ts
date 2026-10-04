import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import request from 'supertest';
import type { App } from 'supertest/types';
import { SignUpUseCase } from '../application/use-cases/sign-up.use-case';
import { VerifyEmailUseCase } from '../application/use-cases/verify-email.use-case';
import { LoginUseCase } from '../application/use-cases/login.use-case';
import { LogoutUseCase } from '../application/use-cases/logout.use-case';
import { RefreshSessionUseCase } from '../application/use-cases/refresh-session.use-case';
import { RequestPasswordResetUseCase } from '../application/use-cases/request-password-reset.use-case';
import { ConfirmPasswordResetUseCase } from '../application/use-cases/confirm-password-reset.use-case';
import { BeginOAuthUseCase } from '../application/use-cases/begin-oauth.use-case';
import { CompleteOAuthUseCase } from '../application/use-cases/complete-oauth.use-case';
import {
  EmailAlreadyExistsError,
  InvalidCredentialsError,
  InvalidResetTokenError,
  InvalidSessionError,
  InvalidVerificationTokenError,
  UnsupportedProviderError,
  UnverifiedEmailError,
} from '../application/auth.errors';
import { AuthController } from '../infrastructure/auth.controller';
import { AUTH_CONFIG } from '../infrastructure/auth.config';

type AsyncMock = jest.Mock<(...args: never[]) => Promise<unknown>>;

describe('auth contract', () => {
  let app: INestApplication<App>;
  const signUp: AsyncMock = jest.fn();
  const verifyEmail: AsyncMock = jest.fn();
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
    basePath: '/api/auth',
    webURL: 'http://localhost:4200',
    trustedOrigins: ['http://localhost:4200', 'http://localhost:3000'],
    allowedProviders: ['google'],
    socialProviders: { google: { clientId: 'id', clientSecret: 'secret' } },
  };

  beforeEach(async () => {
    for (const mock of [
      signUp,
      verifyEmail,
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
        { provide: SignUpUseCase, useValue: { execute: signUp } },
        { provide: VerifyEmailUseCase, useValue: { execute: verifyEmail } },
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

  it('registers an identity pending verification without a session', async () => {
    signUp.mockResolvedValue({
      userId: 'user-1',
      status: 'pending-verification',
    });

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'ada@example.com', password: 'password123' })
      .expect(201)
      .expect({ userId: 'user-1', status: 'pending-verification' })
      .expect((response) => {
        expect(response.headers['set-cookie']).toBeUndefined();
      });

    expect(signUp).toHaveBeenCalledWith({
      email: 'ada@example.com',
      password: 'password123',
    });
  });

  it('rejects invalid signup input', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'not-an-email', password: 'short' })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toBe('Validation failed');
      });

    expect(signUp).not.toHaveBeenCalled();
  });

  it('maps duplicate signup to conflict', async () => {
    signUp.mockRejectedValue(new EmailAlreadyExistsError());

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'ada@example.com', password: 'password123' })
      .expect(409)
      .expect({
        statusCode: 409,
        message: 'Email already exists',
        error: 'Conflict',
      });
  });

  it('verifies an email token without creating a session', async () => {
    verifyEmail.mockResolvedValue({ status: 'verified' });

    await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ token: 'token-1' })
      .expect(200)
      .expect({ status: 'verified' })
      .expect((response) => {
        expect(response.headers['set-cookie']).toBeUndefined();
      });
  });

  it('rejects an invalid verification token', async () => {
    verifyEmail.mockRejectedValue(new InvalidVerificationTokenError());

    await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ token: 'expired' })
      .expect(400);
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

    expect(logout).toHaveBeenCalledWith('better-auth.session_token=abc');
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

  it('returns a uniform non-disclosing reset response', async () => {
    requestReset.mockResolvedValue({
      status: 'accepted',
      message:
        'If this email exists in our system, check your email for the reset link',
    });

    await request(app.getHttpServer())
      .post('/auth/reset-password/request')
      .send({ email: 'ada@example.com' })
      .expect(200)
      .expect({
        status: 'accepted',
        message:
          'If this email exists in our system, check your email for the reset link',
      });

    requestReset.mockResolvedValue({
      status: 'accepted',
      message:
        'If this email exists in our system, check your email for the reset link',
    });

    await request(app.getHttpServer())
      .post('/auth/reset-password/request')
      .send({ email: 'unknown@example.com' })
      .expect(200)
      .expect({
        status: 'accepted',
        message:
          'If this email exists in our system, check your email for the reset link',
      });
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
      })
      .expect((response) => {
        const cookie = response.headers['set-cookie'] as unknown as string[];
        expect(cookie[0]).toContain('better-auth.state=abc');
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
      )
      .expect((response) => {
        expect(response.headers['set-cookie']).toBeUndefined();
      });
  });

  it('handles the verification link by redirecting to the web app', async () => {
    verifyEmail.mockResolvedValue({ status: 'verified' });

    await request(app.getHttpServer())
      .get(
        '/auth/verify-email?token=token-1&redirectTo=http%3A%2F%2Flocalhost%3A4200%2Fverified',
      )
      .expect(302)
      .expect('Location', 'http://localhost:4200/verified?verified=true');

    expect(verifyEmail).toHaveBeenCalledWith({ token: 'token-1' });
  });

  it('redirects a failed verification link without changing state', async () => {
    verifyEmail.mockRejectedValue(new InvalidVerificationTokenError());

    await request(app.getHttpServer())
      .get('/auth/verify-email?token=expired')
      .expect(302)
      .expect('Location', 'http://localhost:4200/verified?error=INVALID_TOKEN');
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

  it('does not redirect email links to untrusted origins', async () => {
    await request(app.getHttpServer())
      .get(
        '/auth/verify-email?token=token-1&redirectTo=http%3A%2F%2Fevil.example.com',
      )
      .expect(302)
      .expect((response) => {
        expect(response.headers.location).toContain(
          'http://localhost:4200/verified',
        );
        expect(response.headers.location).not.toContain('evil.example.com');
      });
  });
});
