import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AuthController } from '../infrastructure/auth.controller';
import { BetterAuthAdapter } from '../infrastructure/better-auth.adapter';
import { AUTH_CONFIG, type AuthConfig } from '../infrastructure/auth.config';
import { LoginUseCase } from '../application/use-cases/login.use-case';
import { ChangePasswordUseCase } from '../application/use-cases/change-password.use-case';
import { GetAccountSummaryUseCase } from '../application/use-cases/get-account-summary.use-case';
import { StartRegistrationUseCase } from '../application/use-cases/start-registration.use-case';
import { ResendVerificationUseCase } from '../application/use-cases/resend-verification.use-case';
import { CompleteSignUpUseCase } from '../application/use-cases/complete-sign-up.use-case';
import { LogoutUseCase } from '../application/use-cases/logout.use-case';
import { RefreshSessionUseCase } from '../application/use-cases/refresh-session.use-case';
import { RequestPasswordResetUseCase } from '../application/use-cases/request-password-reset.use-case';
import { ConfirmPasswordResetUseCase } from '../application/use-cases/confirm-password-reset.use-case';
import { BeginOAuthUseCase } from '../application/use-cases/begin-oauth.use-case';
import { CompleteOAuthUseCase } from '../application/use-cases/complete-oauth.use-case';
import type {
  AccountSummary,
  AccountSummaryReader,
} from '../application/account-summary.reader';

const EMAIL = 'change-password-host@example.com';
const OLD_PASSWORD = 'Current!Pass1';
const NEW_PASSWORD = 'New!Passphrase2';

const CONFIG: AuthConfig = {
  secret: 'host-contract-test-secret-0123456789',
  baseURL: 'http://localhost:3000',
  basePath: '/auth',
  webURL: 'http://localhost:4200',
  trustedOrigins: ['http://localhost:4200', 'http://localhost:3000'],
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

const UNUSED_USE_CASES: Array<new (...args: never[]) => unknown> = [
  StartRegistrationUseCase,
  ResendVerificationUseCase,
  CompleteSignUpUseCase,
  LogoutUseCase,
  RequestPasswordResetUseCase,
  ConfirmPasswordResetUseCase,
  BeginOAuthUseCase,
  CompleteOAuthUseCase,
];

async function createVerifiedIdentity(): Promise<void> {
  const handler = createBetterAuthHandler();
  const signUp = await handler.handler(
    new Request('http://localhost:3000/auth/sign-up/email', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: CONFIG.baseURL,
      },
      body: JSON.stringify({
        email: EMAIL,
        password: OLD_PASSWORD,
        name: EMAIL.split('@')[0],
      }),
    }),
  );

  if (signUp.status >= 400) {
    throw new Error(`sign-up failed with status ${signUp.status}`);
  }

  // The repo's activation flow creates verified identities; mirror that here.
  db.user[0].emailVerified = true;
}

let db: { user: Array<Record<string, unknown>> };

function createBetterAuthHandler() {
  return betterAuth({
    appName: 'auth',
    secret: CONFIG.secret,
    baseURL: CONFIG.baseURL,
    basePath: CONFIG.basePath,
    trustedOrigins: CONFIG.trustedOrigins,
    database: memoryAdapter(db as unknown as Record<string, unknown[]>),
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      requireEmailVerification: true,
    },
    advanced: {
      useSecureCookies: false,
    },
  });
}

class FixedAccountSummaryReader implements AccountSummaryReader {
  read(): Promise<AccountSummary> {
    return Promise.resolve({
      email: EMAIL,
      hasPassword: true,
      passwordUpdatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
  }
}

function cookieHeaderFrom(response: { headers: Record<string, unknown> }): {
  value: string | undefined;
  cookies: string[] | undefined;
} {
  const cookies = response.headers['set-cookie'] as string[] | undefined;
  const value = cookies?.map((cookie) => cookie.split(';', 1)[0]).join('; ');
  return { value, cookies };
}

describe('password change return path (host-level contract)', () => {
  let app: INestApplication<App>;
  let adapter: BetterAuthAdapter;

  beforeAll(async () => {
    db = { user: [], session: [], account: [], verification: [] };
    await createVerifiedIdentity();

    adapter = new BetterAuthAdapter(
      {} as never,
      CONFIG,
      { send: () => Promise.resolve() },
      createBetterAuthHandler(),
    );

    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AUTH_CONFIG, useValue: CONFIG },
        { provide: LoginUseCase, useValue: new LoginUseCase(adapter) },
        {
          provide: RefreshSessionUseCase,
          useValue: new RefreshSessionUseCase(adapter),
        },
        {
          provide: ChangePasswordUseCase,
          useValue: new ChangePasswordUseCase(adapter),
        },
        {
          provide: GetAccountSummaryUseCase,
          useValue: new GetAccountSummaryUseCase(
            adapter,
            new FixedAccountSummaryReader(),
          ),
        },
        ...UNUSED_USE_CASES.map((token) => ({
          provide: token,
          useValue: {
            execute: () => {
              throw new Error('not used in this contract');
            },
          },
        })),
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps the calling session rotated and revokes every other session', async () => {
    // Two devices sign in, so the change has another session to revoke.
    const firstLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: OLD_PASSWORD })
      .expect(200);
    const firstCookie = cookieHeaderFrom(firstLogin).value;
    expect(firstCookie).toBeDefined();

    const secondLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: OLD_PASSWORD })
      .expect(200);
    const secondCookie = cookieHeaderFrom(secondLogin).value;
    expect(secondCookie).toBeDefined();

    // Both sessions work on a protected call before the change.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', firstCookie!)
      .expect(200);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', secondCookie!)
      .expect(200);

    const change = await request(app.getHttpServer())
      .post('/auth/password/change')
      .set('Cookie', firstCookie!)
      .send({ currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD })
      .expect(200)
      .expect({ status: 'ok' });

    // The caller stays signed in through a rotated replacement session cookie.
    const rotatedCookie = cookieHeaderFrom(change).value;
    expect(rotatedCookie).toBeDefined();
    expect(rotatedCookie).not.toBe(firstCookie);

    // The other device's session is revoked.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', secondCookie!)
      .expect(401);

    // The caller's previous cookie is revoked (the session was rotated)...
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', firstCookie!)
      .expect(401);

    // ...but the replacement cookie still authorizes a protected call.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', rotatedCookie!)
      .expect(200);

    // Re-login requires the new password.
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: OLD_PASSWORD })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: NEW_PASSWORD })
      .expect(200);
  });
});
