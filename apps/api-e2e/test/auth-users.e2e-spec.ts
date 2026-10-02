import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import type { Response } from 'supertest';
import { AppModule } from '@app/api/app.module';
import { configureApp } from '@app/api/configure-app';
import {
  AUTH_CONFIG,
  MAIL_PORT,
  type AuthConfig,
} from '@app/auth/infrastructure/auth.config';
import type { MailMessage, MailPort } from '@app/auth/application/mail.port';
import { AuthPrismaService } from '@app/auth/infrastructure/prisma/prisma.service';

const WEB_ORIGIN = 'http://localhost:4200';

class RecordingMailSender implements MailPort {
  readonly messages: MailMessage[] = [];

  send(message: MailMessage): Promise<void> {
    this.messages.push(message);
    return Promise.resolve();
  }
}

function startMockProvider(): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      res.setHeader('connection', 'close');

      if (req.method === 'POST' && req.url?.startsWith('/token')) {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          const code = new URLSearchParams(body).get('code') ?? '';
          res.setHeader('content-type', 'application/json');
          res.end(
            JSON.stringify({
              access_token: code,
              token_type: 'Bearer',
              expires_in: 3600,
              scope: 'openid email',
            }),
          );
        });
        return;
      }

      if (req.method === 'GET' && req.url?.startsWith('/userinfo')) {
        const authorization = req.headers.authorization ?? '';
        const code = authorization.replace(/^Bearer\s+/i, '');
        const email = `${code}@example.com`;
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify({
            id: `provider-${code}`,
            sub: `provider-${code}`,
            email,
            email_verified: code.startsWith('verified'),
            name: 'OAuth User',
          }),
        );
        return;
      }

      res.statusCode = 404;
      res.end();
    });

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

function responseBody<T>(response: Response): T {
  return response.body as T;
}

function cookieHeader(response: Response): string {
  const setCookie = response.headers['set-cookie'] as unknown as
    string[] | undefined;
  if (!setCookie || setCookie.length === 0) {
    return '';
  }

  return setCookie.map((cookie) => cookie.split(';', 1)[0]).join('; ');
}

function linkFrom(message: MailMessage): string {
  const match = message.text.match(/(https?:\/\/[^\s]+)/);
  if (!match) {
    throw new Error(`No link found in message: ${message.text}`);
  }

  return match[1];
}

function requestPathFrom(link: string): string {
  const url = new URL(link);
  return `${url.pathname}${url.search}`;
}

function tokenFromLocation(location: string): string {
  const token = new URL(location).searchParams.get('token');
  if (!token) {
    throw new Error(`No token found in location: ${location}`);
  }

  return token;
}

function signHs256Token(
  payload: Record<string, unknown>,
  secret: string,
): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${signature}`;
}

function expiredVerificationToken(email: string, secret: string): string {
  const now = Math.floor(Date.now() / 1000);
  return signHs256Token({ email, iat: now - 7200, exp: now - 3600 }, secret);
}

async function waitForMail(
  mail: RecordingMailSender,
  predicate: (message: MailMessage) => boolean,
): Promise<MailMessage> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const found = mail.messages.find(predicate);
    if (found) {
      return found;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error('Expected mail was not delivered in time');
}

describe('Auth and users (e2e)', () => {
  let app: INestApplication;
  let providerServer: Server;
  let authConfig: AuthConfig;
  const mail = new RecordingMailSender();

  beforeAll(async () => {
    const provider = await startMockProvider();
    providerServer = provider.server;
    authConfig = {
      secret: 'e2e-auth-secret-0123456789-abcdefghij',
      baseURL: 'http://localhost:3000',
      webURL: WEB_ORIGIN,
      basePath: '/auth',
      trustedOrigins: [WEB_ORIGIN, 'http://localhost:3000'],
      allowedProviders: ['google', 'test-oauth'],
      socialProviders: {
        google: {
          clientId: 'e2e-google-client-id',
          clientSecret: 'e2e-google-client-secret',
        },
      },
      testOAuthProvider: {
        providerId: 'test-oauth',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        authorizationUrl: `${provider.url}/authorize`,
        tokenUrl: `${provider.url}/token`,
        userInfoUrl: `${provider.url}/userinfo`,
        scopes: ['openid', 'email'],
      },
    };

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AUTH_CONFIG)
      .useValue(authConfig)
      .overrideProvider(MAIL_PORT)
      .useValue(mail)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    providerServer.closeAllConnections();
    await new Promise<void>((resolve) => {
      providerServer.close(() => resolve());
    });
  });

  async function signUpAndVerify(email: string): Promise<void> {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .set('Origin', WEB_ORIGIN)
      .send({ email, password: 'password123' })
      .expect(201);

    const verificationMail = await waitForMail(
      mail,
      (message) => message.to === email,
    );
    const link = linkFrom(verificationMail);

    expect(link.startsWith('http://localhost:3000/auth/verify-email')).toBe(
      true,
    );

    await request(app.getHttpServer())
      .get(requestPathFrom(link))
      .expect(302)
      .expect('Location', `${WEB_ORIGIN}/verified?verified=true`);
  }

  it('reports health without a session while preserving the root route', async () => {
    await request(app.getHttpServer())
      .get('/users/health')
      .expect(200)
      .expect({ status: 'ok' });

    await request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('exposes credentialed CORS for the web origin', async () => {
    await request(app.getHttpServer())
      .options('/auth/login')
      .set('Origin', WEB_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .expect((response) => {
        expect(response.headers['access-control-allow-origin']).toBe(
          WEB_ORIGIN,
        );
        expect(response.headers['access-control-allow-credentials']).toBe(
          'true',
        );
      });
  });

  it('runs signup -> verify link -> login -> profile creation, then revokes on logout', async () => {
    const email = `e2e-${Date.now()}@example.com`;

    await signUpAndVerify(email);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', WEB_ORIGIN)
      .send({ email, password: 'password123' })
      .expect(200);

    expect(responseBody<{ status: string }>(loginResponse).status).toBe(
      'authenticated',
    );
    expect(JSON.stringify(loginResponse.body)).not.toContain('session_token');
    const session = cookieHeader(loginResponse);
    expect(session).toContain('better-auth.session_token');

    await request(app.getHttpServer())
      .post('/users')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', session)
      .send({
        name: 'Ada',
        surname: 'Lovelace',
        address: '1 Main Street',
        phone: '555-0100',
      })
      .expect(201)
      .expect((response) => {
        const body = responseBody<{
          id: unknown;
          authUserId: unknown;
          email?: unknown;
          name: string;
          surname: string;
          address: string;
          phone: string;
        }>(response);

        expect(body).toMatchObject({
          name: 'Ada',
          surname: 'Lovelace',
          address: '1 Main Street',
          phone: '555-0100',
        });
        expect(typeof body.id).toBe('number');
        expect(typeof body.authUserId).toBe('string');
        expect(body.email).toBeUndefined();
      });

    await request(app.getHttpServer())
      .post('/users')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', session)
      .send({
        name: 'Ada',
        surname: 'Lovelace',
        address: '1 Main Street',
        phone: '555-0100',
      })
      .expect(409);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', session)
      .expect(200);

    await request(app.getHttpServer())
      .post('/users')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', session)
      .send({
        name: 'Ada',
        surname: 'Lovelace',
        address: '1 Main Street',
        phone: '555-0100',
      })
      .expect(401);
  });

  it('rejects missing, invalid, cross-origin and CSRF-unsafe requests', async () => {
    const email = `e2e-guard-${Date.now()}@example.com`;

    await signUpAndVerify(email);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', WEB_ORIGIN)
      .send({ email, password: 'password123' })
      .expect(200);
    const session = cookieHeader(loginResponse);
    const profile = {
      name: 'Ada',
      surname: 'Lovelace',
      address: '1 Main Street',
      phone: '555-0100',
    };

    await request(app.getHttpServer())
      .post('/users')
      .set('Origin', WEB_ORIGIN)
      .send(profile)
      .expect(401);

    await request(app.getHttpServer())
      .post('/users')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', 'better-auth.session_token=tampered')
      .send(profile)
      .expect(401);

    await request(app.getHttpServer())
      .post('/users')
      .set('Origin', 'http://evil.example.com')
      .set('Cookie', session)
      .send(profile)
      .expect(403);

    await request(app.getHttpServer())
      .post('/users')
      .set('Cookie', session)
      .send(profile)
      .expect(403);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Origin', 'http://evil.example.com')
      .set('Cookie', session)
      .expect(403);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Origin', 'http://evil.example.com')
      .set('Cookie', session)
      .expect(403);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(403);
  });

  it('recovers access with a password reset link and revokes old sessions', async () => {
    const email = `e2e-reset-${Date.now()}@example.com`;

    await signUpAndVerify(email);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', WEB_ORIGIN)
      .send({ email, password: 'password123' })
      .expect(200);
    const oldSession = cookieHeader(loginResponse);

    await request(app.getHttpServer())
      .post('/auth/reset-password/request')
      .set('Origin', WEB_ORIGIN)
      .send({ email })
      .expect(200)
      .expect((response) => {
        expect(responseBody<{ status: string }>(response).status).toBe(
          'accepted',
        );
      });

    await request(app.getHttpServer())
      .post('/auth/reset-password/request')
      .set('Origin', WEB_ORIGIN)
      .send({ email: `unknown-${Date.now()}@example.com` })
      .expect(200)
      .expect((response) => {
        expect(responseBody<{ status: string }>(response).status).toBe(
          'accepted',
        );
      });

    const resetMail = await waitForMail(
      mail,
      (message) =>
        message.to === email && /Reset your password/.test(message.subject),
    );

    const resetLocation = await request(app.getHttpServer())
      .get(requestPathFrom(linkFrom(resetMail)))
      .expect(302)
      .then((response) => response.headers.location);

    expect(resetLocation.startsWith(`${WEB_ORIGIN}/reset-password`)).toBe(true);
    const resetToken = tokenFromLocation(resetLocation);
    const newPassword = 'newpassword456';

    await request(app.getHttpServer())
      .post('/auth/reset-password/confirm')
      .set('Origin', WEB_ORIGIN)
      .send({ token: resetToken, password: newPassword })
      .expect(200)
      .expect({ status: 'ok' });

    await request(app.getHttpServer())
      .post('/auth/reset-password/confirm')
      .set('Origin', WEB_ORIGIN)
      .send({ token: resetToken, password: newPassword })
      .expect(400);

    await request(app.getHttpServer())
      .post('/users')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', oldSession)
      .send({
        name: 'Ada',
        surname: 'Lovelace',
        address: '1 Main Street',
        phone: '555-0100',
      })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', WEB_ORIGIN)
      .send({ email, password: 'password123' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', WEB_ORIGIN)
      .send({ email, password: newPassword })
      .expect(200);
  });

  it('rejects an expired verification token', async () => {
    const email = `e2e-expired-verify-${Date.now()}@example.com`;

    await request(app.getHttpServer())
      .post('/auth/signup')
      .set('Origin', WEB_ORIGIN)
      .send({ email, password: 'password123' })
      .expect(201);

    const token = expiredVerificationToken(email, authConfig.secret);

    await request(app.getHttpServer())
      .get(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .expect(302)
      .expect('Location', `${WEB_ORIGIN}/verified?error=INVALID_TOKEN`);
  });

  it('accepts a reused verification token idempotently without creating a session', async () => {
    const email = `e2e-reused-verify-${Date.now()}@example.com`;

    await request(app.getHttpServer())
      .post('/auth/signup')
      .set('Origin', WEB_ORIGIN)
      .send({ email, password: 'password123' })
      .expect(201);

    const verificationMail = await waitForMail(
      mail,
      (message) => message.to === email,
    );
    const verificationLink = linkFrom(verificationMail);
    const token = tokenFromLocation(verificationLink);

    const firstVerification = await request(app.getHttpServer())
      .post('/auth/verify-email')
      .set('Origin', WEB_ORIGIN)
      .send({ token })
      .expect(200)
      .expect({ status: 'verified' });

    expect(cookieHeader(firstVerification)).toBe('');

    const repeatedVerification = await request(app.getHttpServer())
      .post('/auth/verify-email')
      .set('Origin', WEB_ORIGIN)
      .send({ token })
      .expect(200)
      .expect({ status: 'verified' });

    expect(cookieHeader(repeatedVerification)).toBe('');

    const repeatedLink = await request(app.getHttpServer())
      .get(requestPathFrom(verificationLink))
      .expect(302)
      .expect('Location', `${WEB_ORIGIN}/verified?verified=true`);

    expect(cookieHeader(repeatedLink)).toBe('');

    const user = await app.get(AuthPrismaService).user.findUnique({
      where: { email },
      select: { emailVerified: true },
    });
    expect(user?.emailVerified).toBe(true);
  });

  it('rejects an expired password reset token', async () => {
    const email = `e2e-expired-reset-${Date.now()}@example.com`;
    await signUpAndVerify(email);

    await request(app.getHttpServer())
      .post('/auth/reset-password/request')
      .set('Origin', WEB_ORIGIN)
      .send({ email })
      .expect(200);

    const resetMail = await waitForMail(
      mail,
      (message) =>
        message.to === email && /Reset your password/.test(message.subject),
    );
    const resetLocation = await request(app.getHttpServer())
      .get(requestPathFrom(linkFrom(resetMail)))
      .expect(302)
      .then((response) => response.headers.location);
    const resetToken = tokenFromLocation(resetLocation);

    const prisma = app.get(AuthPrismaService);
    await prisma.verification.updateMany({
      data: { expiresAt: new Date(Date.now() - 60_000) },
      where: { expiresAt: { gt: new Date() } },
    });

    await request(app.getHttpServer())
      .post('/auth/reset-password/confirm')
      .set('Origin', WEB_ORIGIN)
      .send({ token: resetToken, password: 'newpassword456' })
      .expect(400);
  });

  it('rejects an expired session and does not renew it', async () => {
    const email = `e2e-expired-session-${Date.now()}@example.com`;
    await signUpAndVerify(email);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', WEB_ORIGIN)
      .send({ email, password: 'password123' })
      .expect(200);
    const session = cookieHeader(loginResponse);
    const { userId } = responseBody<{ userId: string }>(loginResponse);

    const prisma = app.get(AuthPrismaService);
    await prisma.session.updateMany({
      where: { userId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    await request(app.getHttpServer())
      .post('/users')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', session)
      .send({
        name: 'Ada',
        surname: 'Lovelace',
        address: '1 Main Street',
        phone: '555-0100',
      })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', session)
      .expect(401)
      .expect((response) => {
        expect(response.headers['set-cookie']).toBeUndefined();
      });
  });

  it('aligns the OAuth redirect URI with the exposed callback route', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/oauth/google')
      .set('Origin', WEB_ORIGIN)
      .expect(200);

    const body = responseBody<{
      provider: string;
      authorizationUrl: string;
    }>(response);

    expect(body.provider).toBe('google');

    const authorizationUrl = new URL(body.authorizationUrl);
    expect(authorizationUrl.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/auth/callback/google',
    );

    await request(app.getHttpServer())
      .post('/auth/oauth/github')
      .set('Origin', WEB_ORIGIN)
      .expect(400);
  });

  it('completes a full OAuth callback with a simulated provider', async () => {
    const code = `verified-oauth-${Date.now()}`;

    const startResponse = await request(app.getHttpServer())
      .post('/auth/oauth/test-oauth')
      .set('Origin', WEB_ORIGIN)
      .expect(200);

    const startBody = responseBody<{ authorizationUrl: string }>(startResponse);
    const stateCookie = cookieHeader(startResponse);
    expect(stateCookie).toContain('better-auth.state');

    const state = new URL(startBody.authorizationUrl).searchParams.get('state');
    expect(state).toBeTruthy();

    const callbackResponse = await request(app.getHttpServer())
      .get(
        `/auth/callback/test-oauth?code=${encodeURIComponent(
          code,
        )}&state=${encodeURIComponent(state ?? '')}`,
      )
      .set('Cookie', stateCookie)
      .expect(302);

    expect(callbackResponse.headers.location).toContain(
      `${WEB_ORIGIN}/auth/oauth/callback`,
    );
    const session = cookieHeader(callbackResponse);
    expect(session).toContain('better-auth.session_token');

    await request(app.getHttpServer())
      .post('/users')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', session)
      .send({
        name: 'Ada',
        surname: 'Lovelace',
        address: '1 Main Street',
        phone: '555-0100',
      })
      .expect(201);
  });

  it('rejects an OAuth callback whose provider email is unverified', async () => {
    const code = `unverified-oauth-${Date.now()}`;

    const startResponse = await request(app.getHttpServer())
      .post('/auth/oauth/test-oauth')
      .set('Origin', WEB_ORIGIN)
      .expect(200);

    const state = new URL(
      responseBody<{ authorizationUrl: string }>(startResponse)
        .authorizationUrl,
    ).searchParams.get('state');

    const callbackResponse = await request(app.getHttpServer())
      .get(
        `/auth/callback/test-oauth?code=${encodeURIComponent(
          code,
        )}&state=${encodeURIComponent(state ?? '')}`,
      )
      .set('Cookie', cookieHeader(startResponse))
      .expect(302);

    expect(callbackResponse.headers.location).toContain(
      'error=email_not_verified',
    );
    expect(cookieHeader(callbackResponse)).not.toContain(
      'better-auth.session_token',
    );
  });
});
