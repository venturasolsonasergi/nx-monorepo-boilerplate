import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types';
import request from 'supertest';
import type { Response } from 'supertest';
import { AppModule } from '@app/api/app.module';
import { configureApp } from '@app/api/configure-app';
import {
  AUTH_CONFIG,
  AUTH_PROVIDER,
  MAIL_PORT,
  type AuthConfig,
} from '@app/auth/infrastructure/auth.config';
import type { MailMessage, MailPort } from '@app/auth/application/mail.port';
import {
  BetterAuthAdapter,
  createBetterAuthHandler,
  type BetterAuthHandler,
} from '@app/auth/infrastructure/better-auth.adapter';
import { AuthPrismaService } from '@app/auth/infrastructure/prisma/prisma.service';

const WEB_ORIGIN = 'http://localhost:4200';
const PASSWORD = 'password123';

class RecordingMailSender implements MailPort {
  readonly messages: MailMessage[] = [];

  send(message: MailMessage): Promise<void> {
    this.messages.push(message);
    return Promise.resolve();
  }
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

describe('Completion with a post-commit session failure (e2e)', () => {
  let app: INestApplication<App>;
  const mail = new RecordingMailSender();

  beforeAll(async () => {
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
      smtp: null,
      verificationLimits: {
        resendWindowSeconds: 60,
        sourceWindowSeconds: 3600,
        sourceMax: 1000,
        retentionSeconds: 86400,
      },
      trustedProxies: [],
    };

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AUTH_CONFIG)
      .useValue(authConfig)
      .overrideProvider(MAIL_PORT)
      .useValue(mail)
      .overrideProvider(AUTH_PROVIDER)
      .useFactory({
        factory: (
          prisma: AuthPrismaService,
          config: AuthConfig,
          mailPort: MailPort,
        ): BetterAuthAdapter => {
          // Delegate to the real Better Auth handler, but fail the very first
          // sign-in (the completion's post-commit session issuance).
          const real: BetterAuthHandler = createBetterAuthHandler(
            prisma,
            config,
            mailPort,
          );
          let signInAttempts = 0;
          const failingOnce: BetterAuthHandler = {
            handler: (incoming: Request) => {
              if (new URL(incoming.url).pathname.endsWith('/sign-in/email')) {
                signInAttempts += 1;
                if (signInAttempts === 1) {
                  return Promise.resolve(
                    new Response(JSON.stringify({ message: 'rate limited' }), {
                      status: 429,
                      headers: {
                        'content-type': 'application/json',
                        'x-retry-after': '5',
                      },
                    }),
                  );
                }
              }
              return real.handler(incoming);
            },
          };
          return new BetterAuthAdapter(prisma, config, mailPort, failingOnce);
        },
        inject: [AuthPrismaService, AUTH_CONFIG, MAIL_PORT],
      })
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
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
      if (app) {
        await app.close();
      }
    }
  });

  it('reports committed activation on session failure and allows a later login', async () => {
    const email = `partial-session-${Date.now()}@example.com`;

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

    const complete = await request(app.getHttpServer())
      .post('/auth/signup/complete')
      .set('Origin', WEB_ORIGIN)
      .send({ token, password: PASSWORD })
      .expect(429)
      .expect('Retry-After', '5');

    expect(complete.body).toMatchObject({ accountActivated: true });
    expect(cookieHeader(complete)).toBe('');

    const stored = await app
      .get(AuthPrismaService)
      .user.findUnique({ where: { email } });
    expect(stored?.emailVerified).toBe(true);

    // The committed password works through normal login.
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', WEB_ORIGIN)
      .send({ email, password: PASSWORD })
      .expect(200);
    expect(cookieHeader(login)).toContain('better-auth.session_token');
  }, 30000);
});
