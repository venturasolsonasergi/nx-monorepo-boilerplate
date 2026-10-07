import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types';
import request from 'supertest';
import type { Response } from 'supertest';
import { AppModule } from '@app/api/app.module';
import { configureApp } from '@app/api/configure-app';
import {
  AUTH_CONFIG,
  type AuthConfig,
} from '@app/auth/infrastructure/auth.config';
import { AuthPrismaService } from '@app/auth/infrastructure/prisma/prisma.service';
import {
  InProcessSmtpServer,
  getFreePort,
  type CapturedMail,
} from './support/in-process-smtp';

const WEB_ORIGIN = 'http://localhost:4200';
const PASSWORD = 'password123';

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

function decodeQuotedPrintable(data: string): string {
  return data
    .replace(/=\r?\n/g, '')
    .replace(/=3D/gi, '=')
    .replace(/=0A/gi, '\n');
}

function linkFrom(mail: CapturedMail): string {
  const match = decodeQuotedPrintable(mail.data).match(/(https?:\/\/[^\s]+)/);
  if (!match) {
    throw new Error(`No link found in message: ${mail.data}`);
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Auth email delivery (e2e, real SMTP)', () => {
  let app: INestApplication<App>;
  let smtp: InProcessSmtpServer;
  let port: number;

  function testEmail(label: string): string {
    return `smtp-${label}-${Date.now()}@example.com`;
  }

  beforeAll(async () => {
    port = await getFreePort();
    smtp = new InProcessSmtpServer();

    const authConfig: AuthConfig = {
      secret: 'e2e-auth-secret-0123456789-abcdefghij',
      baseURL: 'http://localhost:3000',
      webURL: WEB_ORIGIN,
      basePath: '/auth',
      trustedOrigins: [WEB_ORIGIN, 'http://localhost:3000'],
      allowedProviders: [],
      socialProviders: {},
      isProduction: false,
      supportEmail: 'support@example.com',
      smtp: {
        host: '127.0.0.1',
        port,
        secure: false,
        user: 'mailer',
        password: 'secret',
        from: 'no-reply@example.com',
      },
      verificationLimits: {
        resendWindowSeconds: 1,
        sourceWindowSeconds: 3600,
        sourceMax: 1000,
        retentionSeconds: 86400,
      },
      trustedProxies: ['127.0.0.1', '::1'],
    };

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AUTH_CONFIG)
      .useValue(authConfig)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    await app.get(AuthPrismaService).pendingRegistration.deleteMany({});
  });

  afterAll(async () => {
    try {
      if (app) {
        const prisma = app.get(AuthPrismaService);
        await prisma.session.deleteMany({});
        await prisma.account.deleteMany({});
        await prisma.pendingRegistration.deleteMany({});
        await prisma.verificationResendThrottle.deleteMany({});
        await prisma.user.deleteMany({});
      }
    } finally {
      if (smtp) {
        await smtp.close();
      }
      if (app) {
        await app.close();
      }
    }
  });

  it('recovers from a failed initial send via resend, then activates and authenticates', async () => {
    const email = testEmail('recover');

    // The SMTP listener is not yet accepting connections, so the initial send
    // must be reported as a transport failure without a session or identity.
    const failed = await request(app.getHttpServer())
      .post('/auth/signup')
      .set('Origin', WEB_ORIGIN)
      .send({ email })
      .expect(201);
    expect(responseBody<{ emailStatus: string }>(failed).emailStatus).toBe(
      'failed',
    );
    expect(
      await app.get(AuthPrismaService).user.findUnique({ where: { email } }),
    ).toBeNull();

    await smtp.listen(port);
    // The per-address window is one second; wait it out so the resend is allowed.
    await sleep(1200);

    await request(app.getHttpServer())
      .post('/auth/verification/resend')
      .set('Origin', WEB_ORIGIN)
      .send({ email })
      .expect(200)
      .expect({ status: 'accepted' });

    const mail = await smtp.waitFor((message) => message.data.includes(email));
    const location = await request(app.getHttpServer())
      .get(requestPathFrom(linkFrom(mail)))
      .expect(302)
      .then((response) => response.headers.location);
    expect(location.startsWith(`${WEB_ORIGIN}/complete-signup`)).toBe(true);

    const complete = await request(app.getHttpServer())
      .post('/auth/signup/complete')
      .set('Origin', WEB_ORIGIN)
      .send({ token: tokenFromLocation(location), password: PASSWORD })
      .expect(200);
    expect(responseBody<{ status: string }>(complete).status).toBe(
      'authenticated',
    );
    const session = cookieHeader(complete);
    expect(session).toContain('better-auth.session_token');

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', session)
      .expect(200)
      .expect((response) => {
        expect(responseBody<{ status: string }>(response).status).toBe(
          'authenticated',
        );
      });

    // A verified session reaches the protected route (no profile yet => 404,
    // never 401).
    await request(app.getHttpServer())
      .get('/users/me')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', session)
      .expect(404);
  }, 30000);

  it('a scanner opening the emailed link cannot activate or create a session', async () => {
    const email = testEmail('scanner');

    const signup = await request(app.getHttpServer())
      .post('/auth/signup')
      .set('Origin', WEB_ORIGIN)
      .send({ email })
      .expect(201);
    expect(responseBody<{ emailStatus: string }>(signup).emailStatus).toBe(
      'accepted',
    );
    // The configured SMTP credentials are exercised end to end.
    expect(smtp.authAttempts.length).toBeGreaterThan(0);

    const mail = await smtp.waitFor((message) => message.data.includes(email));
    const location = await request(app.getHttpServer())
      .get(requestPathFrom(linkFrom(mail)))
      .expect(302)
      .then((response) => response.headers.location);
    expect(location.startsWith(`${WEB_ORIGIN}/complete-signup`)).toBe(true);

    // Opening the link alone must not have created an identity.
    expect(
      await app.get(AuthPrismaService).user.findUnique({ where: { email } }),
    ).toBeNull();

    const complete = await request(app.getHttpServer())
      .post('/auth/signup/complete')
      .set('Origin', WEB_ORIGIN)
      .send({ token: tokenFromLocation(location), password: PASSWORD })
      .expect(200);
    expect(cookieHeader(complete)).toContain('better-auth.session_token');
  }, 30000);
});
