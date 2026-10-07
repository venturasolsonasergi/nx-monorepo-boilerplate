import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHash, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import type { Response } from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '@app/api/app.module';
import { configureApp } from '@app/api/configure-app';
import {
  AUTH_CONFIG,
  MAIL_PORT,
  type AuthConfig,
} from '@app/auth/infrastructure/auth.config';
import type { MailMessage, MailPort } from '@app/auth/application/mail.port';
import { AuthPrismaService } from '@app/auth/infrastructure/prisma/prisma.service';
import { PrismaService } from '@app/users/infrastructure/prisma/prisma.service';

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
  let app: INestApplication<App>;
  let providerServer: Server;
  let authConfig: AuthConfig;
  const mail = new RecordingMailSender();
  const testEmails = new Set<string>();

  function testEmail(label: string): string {
    const email = `e2e-${label}-${Date.now()}@example.com`;
    testEmails.add(email);
    return email;
  }

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
      isProduction: false,
      supportEmail: 'support@example.com',
      smtp: null,
      verificationLimits: {
        resendWindowSeconds: 60,
        sourceWindowSeconds: 3600,
        sourceMax: 1000,
        retentionSeconds: 86400,
      },
      trustedProxies: ['127.0.0.1', '::1'],
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
    try {
      if (app) {
        const authPrisma = app.get(AuthPrismaService);
        const usersPrisma = app.get(PrismaService);

        // E2E runs against dedicated, disposable databases, so the whole
        // fixture is reset instead of only the identities tracked by this
        // suite. This also removes verification-token rows (reset-password:*,
        // auth-state:*) whose identifiers are not derived from an email.
        await usersPrisma.userProfile.deleteMany({});
        await authPrisma.session.deleteMany({});
        await authPrisma.account.deleteMany({});
        await authPrisma.verification.deleteMany({});
        await authPrisma.user.deleteMany({});
      }
    } finally {
      if (app) {
        await app.close();
      }
      if (providerServer) {
        providerServer.closeAllConnections();
        await new Promise<void>((resolve) => {
          providerServer.close(() => resolve());
        });
      }
    }
  });

  async function signUpAndActivate(
    email: string,
    password = 'password123',
  ): Promise<{ userId: string; session: string }> {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .set('Origin', WEB_ORIGIN)
      .send({ email })
      .expect(201);

    const verificationMail = await waitForMail(
      mail,
      (message) => message.to === email,
    );
    const link = linkFrom(verificationMail);

    expect(link.startsWith('http://localhost:3000/auth/verify-email')).toBe(
      true,
    );

    const location = await request(app.getHttpServer())
      .get(requestPathFrom(link))
      .expect(302)
      .then((response) => response.headers.location);

    expect(location.startsWith(`${WEB_ORIGIN}/complete-signup`)).toBe(true);
    const token = tokenFromLocation(location);

    const complete = await request(app.getHttpServer())
      .post('/auth/signup/complete')
      .set('Origin', WEB_ORIGIN)
      .send({ token, password })
      .expect(200);

    return {
      userId: responseBody<{ userId: string }>(complete).userId,
      session: cookieHeader(complete),
    };
  }

  async function signUpAndVerify(email: string): Promise<void> {
    await signUpAndActivate(email);
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
    const email = testEmail('profile');

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

  it('retrieves the caller profile and isolates identities via GET /users/me', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401).expect({
      statusCode: 401,
      message: 'Invalid session',
      error: 'Unauthorized',
    });

    const emailA = testEmail('me-a');
    await signUpAndVerify(emailA);

    const loginA = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', WEB_ORIGIN)
      .send({ email: emailA, password: 'password123' })
      .expect(200);
    const sessionA = cookieHeader(loginA);
    const { userId: userIdA } = responseBody<{ userId: string }>(loginA);

    await request(app.getHttpServer())
      .post('/users')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', sessionA)
      .send({
        name: 'Ada',
        surname: 'Lovelace',
        address: '1 Main Street',
        phone: '555-0100',
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/users/me')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', sessionA)
      .expect(200)
      .expect((response) => {
        const body = responseBody<{
          id: unknown;
          authUserId: unknown;
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
        expect(body.authUserId).toBe(userIdA);
      });

    const emailB = testEmail('me-b');
    await signUpAndVerify(emailB);

    const loginB = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', WEB_ORIGIN)
      .send({ email: emailB, password: 'password123' })
      .expect(200);
    const sessionB = cookieHeader(loginB);

    await request(app.getHttpServer())
      .get('/users/me')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', sessionB)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/users/me?authUserId=${encodeURIComponent(userIdA)}`)
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', sessionB)
      .expect(404)
      .expect((response) => {
        expect(JSON.stringify(response.body)).not.toContain('Ada');
      });
  });

  it('issues UUID-format ids for new identities while legacy ids still resolve', async () => {
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const email = testEmail('uuid');
    const prisma = app.get(AuthPrismaService);

    const { userId } = await signUpAndActivate(email);
    expect(userId).toMatch(uuidPattern);

    const storedUser = await prisma.user.findUnique({ where: { email } });
    expect(storedUser?.id).toBe(userId);
    expect(storedUser?.emailVerified).toBe(true);

    const account = await prisma.account.findFirst({ where: { userId } });
    expect(account?.id).toMatch(uuidPattern);

    const legacyId = `legacy-e2e-${Date.now()}`;
    await prisma.user.upsert({
      where: { id: legacyId },
      update: {},
      create: {
        id: legacyId,
        name: 'Legacy User',
        email: testEmail('legacy-uuid'),
        emailVerified: true,
      },
    });
    const legacyUser = await prisma.user.findUnique({
      where: { id: legacyId },
    });
    expect(legacyUser?.id).toBe(legacyId);
    expect(legacyUser?.id).not.toMatch(uuidPattern);

    const verificationMail = await waitForMail(mail, (m) => m.to === email);
    await request(app.getHttpServer())
      .get(requestPathFrom(linkFrom(verificationMail)))
      .expect(302);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', WEB_ORIGIN)
      .send({ email, password: 'password123' })
      .expect(200);
    expect(responseBody<{ userId: string }>(loginResponse).userId).toBe(userId);

    const session = await prisma.session.findFirst({ where: { userId } });
    expect(session?.id).toMatch(uuidPattern);

    await request(app.getHttpServer())
      .post('/auth/reset-password/request')
      .set('Origin', WEB_ORIGIN)
      .send({ email })
      .expect(200);

    const verification = await prisma.verification.findFirst({
      where: { identifier: { startsWith: 'reset-password:' } },
      orderBy: { createdAt: 'desc' },
    });
    expect(verification?.id).toMatch(uuidPattern);
  });

  it('keeps a pre-existing session valid for a legacy-id identity across the standardization', async () => {
    const email = testEmail('legacy-session');
    const prisma = app.get(AuthPrismaService);

    await signUpAndVerify(email);

    // A session issued for the identity, as it would exist before the physical
    // naming/identifier standardization.
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', WEB_ORIGIN)
      .send({ email, password: 'password123' })
      .expect(200);
    const { userId } = responseBody<{ userId: string }>(loginResponse);
    const session = cookieHeader(loginResponse);
    expect(session).toContain('better-auth.session_token');

    // Simulate an identity and its session persisted before the standardization:
    // rewrite the id to a non-UUID legacy string. The FK is ON UPDATE CASCADE, so
    // the session and account rows follow the identity.
    const legacyId = `legacy-session-${Date.now()}`;
    await prisma.user.update({ where: { id: userId }, data: { id: legacyId } });

    const migratedUser = await prisma.user.findUnique({ where: { email } });
    expect(migratedUser?.id).toBe(legacyId);
    const migratedSession = await prisma.session.findFirst({
      where: { userId: legacyId },
    });
    expect(migratedSession).not.toBeNull();

    // The pre-existing session still authenticates a protected route and reports
    // the legacy identifier.
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
        const body = responseBody<{ authUserId: string }>(response);
        expect(body.authUserId).toBe(legacyId);
      });

    // The pre-existing session can still be refreshed and resolves the same
    // legacy identity.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', session)
      .expect(200)
      .expect({ userId: legacyId, status: 'authenticated' });
  });

  it('rejects missing, invalid, cross-origin and CSRF-unsafe requests', async () => {
    const email = testEmail('guard');

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
    const email = testEmail('reset');

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

  it('rejects login before activation without creating an identity or session', async () => {
    const email = testEmail('unverified-login');
    const prisma = app.get(AuthPrismaService);

    await request(app.getHttpServer())
      .post('/auth/signup')
      .set('Origin', WEB_ORIGIN)
      .send({ email })
      .expect(201);

    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();

    await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', WEB_ORIGIN)
      .send({ email, password: 'password123' })
      .expect(401);
  });

  it('rejects completion for an expired registration', async () => {
    const email = testEmail('expired-verify');
    const prisma = app.get(AuthPrismaService);

    await request(app.getHttpServer())
      .post('/auth/signup')
      .set('Origin', WEB_ORIGIN)
      .send({ email })
      .expect(201);

    const verificationMail = await waitForMail(
      mail,
      (message) => message.to === email,
    );
    const location = await request(app.getHttpServer())
      .get(requestPathFrom(linkFrom(verificationMail)))
      .expect(302)
      .then((response) => response.headers.location);
    const token = tokenFromLocation(location);

    await prisma.pendingRegistration.updateMany({
      where: { email },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    await request(app.getHttpServer())
      .post('/auth/signup/complete')
      .set('Origin', WEB_ORIGIN)
      .send({ token, password: 'password123' })
      .expect(400);
  });

  it('rejects a replayed registration token', async () => {
    const email = testEmail('reused-verify');

    await request(app.getHttpServer())
      .post('/auth/signup')
      .set('Origin', WEB_ORIGIN)
      .send({ email })
      .expect(201);

    const verificationMail = await waitForMail(
      mail,
      (message) => message.to === email,
    );
    const location = await request(app.getHttpServer())
      .get(requestPathFrom(linkFrom(verificationMail)))
      .expect(302)
      .then((response) => response.headers.location);
    const token = tokenFromLocation(location);

    const first = await request(app.getHttpServer())
      .post('/auth/signup/complete')
      .set('Origin', WEB_ORIGIN)
      .send({ token, password: 'password123' })
      .expect(200);

    expect(cookieHeader(first)).toContain('better-auth.session_token');

    await request(app.getHttpServer())
      .post('/auth/signup/complete')
      .set('Origin', WEB_ORIGIN)
      .send({ token, password: 'password456' })
      .expect(400);
  });

  it('rejects an expired password reset token', async () => {
    const email = testEmail('expired-reset');
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
      where: { identifier: `reset-password:${resetToken}` },
    });

    await request(app.getHttpServer())
      .post('/auth/reset-password/confirm')
      .set('Origin', WEB_ORIGIN)
      .send({ token: resetToken, password: 'newpassword456' })
      .expect(400);
  });

  it('rejects an expired session and does not renew it', async () => {
    const email = testEmail('expired-session');
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

  it('shares the address limit between signup and an immediate resend', async () => {
    const email = testEmail('resend-share');

    const signup = await request(app.getHttpServer())
      .post('/auth/signup')
      .set('Origin', WEB_ORIGIN)
      .send({ email })
      .expect(201);
    expect(responseBody<{ emailStatus: string }>(signup).emailStatus).toBe(
      'accepted',
    );

    await request(app.getHttpServer())
      .post('/auth/verification/resend')
      .set('Origin', WEB_ORIGIN)
      .send({ email })
      .expect(200)
      .expect((response) => {
        expect(responseBody<{ status: string }>(response).status).toBe(
          'accepted',
        );
      });

    const delivered = mail.messages.filter((message) => message.to === email);
    expect(delivered).toHaveLength(1);
  });

  it('keeps the activation link valid under concurrent signups', async () => {
    const email = testEmail('concurrent-signup');

    await Promise.all([
      request(app.getHttpServer())
        .post('/auth/signup')
        .set('Origin', WEB_ORIGIN)
        .send({ email })
        .expect(201),
      request(app.getHttpServer())
        .post('/auth/signup')
        .set('Origin', WEB_ORIGIN)
        .send({ email })
        .expect(201),
    ]);

    const prisma = app.get(AuthPrismaService);
    const stored = await prisma.pendingRegistration.findUnique({
      where: { email },
    });
    expect(stored?.tokenHash).not.toBeNull();

    const verificationMail = await waitForMail(
      mail,
      (message) => message.to === email,
    );
    const location = await request(app.getHttpServer())
      .get(requestPathFrom(linkFrom(verificationMail)))
      .expect(302)
      .then((response) => response.headers.location);
    const token = tokenFromLocation(location);

    await request(app.getHttpServer())
      .post('/auth/signup/complete')
      .set('Origin', WEB_ORIGIN)
      .send({ token, password: 'password123' })
      .expect(200);
  });

  it('refuses to activate over an already verified identity', async () => {
    const email = testEmail('activation-conflict');
    await signUpAndActivate(email);

    const prisma = app.get(AuthPrismaService);
    const token = `activation-conflict-${Date.now()}`;
    await prisma.pendingRegistration.deleteMany({ where: { email } });
    await prisma.pendingRegistration.create({
      data: {
        id: randomUUID(),
        email,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3_600_000),
        tokenHash: createHash('sha256').update(token).digest('hex'),
      },
    });

    await request(app.getHttpServer())
      .post('/auth/signup/complete')
      .set('Origin', WEB_ORIGIN)
      .send({ token, password: 'password123' })
      .expect(409);
  });

  it('preserves an eligible legacy unverified identity id on activation', async () => {
    const email = testEmail('legacy-activate');
    const prisma = app.get(AuthPrismaService);
    const legacyId = `legacy-${Date.now()}`;

    await prisma.user.create({
      data: { id: legacyId, name: 'Legacy', email, emailVerified: false },
    });

    const token = `legacy-token-${Date.now()}`;
    await prisma.pendingRegistration.create({
      data: {
        id: randomUUID(),
        email,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3_600_000),
        tokenHash: createHash('sha256').update(token).digest('hex'),
      },
    });

    const complete = await request(app.getHttpServer())
      .post('/auth/signup/complete')
      .set('Origin', WEB_ORIGIN)
      .send({ token, password: 'password123' })
      .expect(200);

    expect(responseBody<{ userId: string }>(complete).userId).toBe(legacyId);

    const stored = await prisma.user.findUnique({ where: { email } });
    expect(stored?.id).toBe(legacyId);
    expect(stored?.emailVerified).toBe(true);
  });

  it('activates exactly once under concurrent completion', async () => {
    const email = testEmail('concurrent-activate');

    await request(app.getHttpServer())
      .post('/auth/signup')
      .set('Origin', WEB_ORIGIN)
      .send({ email })
      .expect(201);

    const verificationMail = await waitForMail(
      mail,
      (message) => message.to === email,
    );
    const location = await request(app.getHttpServer())
      .get(requestPathFrom(linkFrom(verificationMail)))
      .expect(302)
      .then((response) => response.headers.location);
    const token = tokenFromLocation(location);

    const attempts = await Promise.all([
      request(app.getHttpServer())
        .post('/auth/signup/complete')
        .set('Origin', WEB_ORIGIN)
        .send({ token, password: 'password123' }),
      request(app.getHttpServer())
        .post('/auth/signup/complete')
        .set('Origin', WEB_ORIGIN)
        .send({ token, password: 'password123' }),
    ]);

    const statuses = attempts.map((response) => response.status).sort();
    expect(statuses).toEqual([200, 400]);
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
    testEmails.add(`${code}@example.com`);

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

  it('attributes sessions to the trusted client source and isolates clients', async () => {
    const email = testEmail('ip-attribution');
    await signUpAndVerify(email);

    const loginA = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', WEB_ORIGIN)
      .set('X-Forwarded-For', '203.0.113.10')
      .send({ email, password: 'password123' })
      .expect(200);
    const { userId } = responseBody<{ userId: string }>(loginA);
    expect(cookieHeader(loginA)).toContain('better-auth.session_token');

    await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', WEB_ORIGIN)
      .set('X-Forwarded-For', '203.0.113.20')
      .send({ email, password: 'password123' })
      .expect(200);

    const sessions = await app
      .get(AuthPrismaService)
      .session.findMany({ where: { userId } });
    const addresses = sessions.map((session) => session.ipAddress);

    expect(addresses).toContain('203.0.113.10');
    expect(addresses).toContain('203.0.113.20');
  });

  it('rejects an OAuth callback whose provider email is unverified', async () => {
    const code = `unverified-oauth-${Date.now()}`;
    testEmails.add(`${code}@example.com`);

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
