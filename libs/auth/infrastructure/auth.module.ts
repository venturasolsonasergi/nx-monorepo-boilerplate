import { Module } from '@nestjs/common';
import type { AuthProvider } from '../application/auth-provider.port';
import { SignUpUseCase } from '../application/use-cases/sign-up.use-case';
import { VerifyEmailUseCase } from '../application/use-cases/verify-email.use-case';
import { LoginUseCase } from '../application/use-cases/login.use-case';
import { LogoutUseCase } from '../application/use-cases/logout.use-case';
import { RefreshSessionUseCase } from '../application/use-cases/refresh-session.use-case';
import { RequestPasswordResetUseCase } from '../application/use-cases/request-password-reset.use-case';
import { ConfirmPasswordResetUseCase } from '../application/use-cases/confirm-password-reset.use-case';
import { BeginOAuthUseCase } from '../application/use-cases/begin-oauth.use-case';
import { CompleteOAuthUseCase } from '../application/use-cases/complete-oauth.use-case';
import { ValidateSessionUseCase } from '../application/use-cases/validate-session.use-case';
import { AuthController } from './auth.controller';
import { BetterAuthAdapter } from './better-auth.adapter';
import { SmtpMailSender } from './mail/smtp-mail.sender';
import { OriginValidationMiddleware } from './origin-validation.middleware';
import { SessionValidationMiddleware } from './session-validation.middleware';
import { AuthPrismaService } from './prisma/prisma.service';
import {
  AUTH_ALLOWED_PROVIDERS,
  AUTH_CONFIG,
  AUTH_PROVIDER,
  MAIL_PORT,
  loadAuthConfig,
} from './auth.config';

@Module({
  controllers: [AuthController],
  providers: [
    AuthPrismaService,
    {
      provide: AUTH_CONFIG,
      useFactory: () => loadAuthConfig(),
    },
    {
      provide: AUTH_ALLOWED_PROVIDERS,
      useFactory: (config: ReturnType<typeof loadAuthConfig>) =>
        config.allowedProviders,
      inject: [AUTH_CONFIG],
    },
    {
      provide: MAIL_PORT,
      useClass: SmtpMailSender,
    },
    {
      provide: AUTH_PROVIDER,
      useClass: BetterAuthAdapter,
    },
    {
      provide: SignUpUseCase,
      useFactory: (provider: AuthProvider) => new SignUpUseCase(provider),
      inject: [AUTH_PROVIDER],
    },
    {
      provide: VerifyEmailUseCase,
      useFactory: (provider: AuthProvider) => new VerifyEmailUseCase(provider),
      inject: [AUTH_PROVIDER],
    },
    {
      provide: LoginUseCase,
      useFactory: (provider: AuthProvider) => new LoginUseCase(provider),
      inject: [AUTH_PROVIDER],
    },
    {
      provide: LogoutUseCase,
      useFactory: (provider: AuthProvider) => new LogoutUseCase(provider),
      inject: [AUTH_PROVIDER],
    },
    {
      provide: RefreshSessionUseCase,
      useFactory: (provider: AuthProvider) =>
        new RefreshSessionUseCase(provider),
      inject: [AUTH_PROVIDER],
    },
    {
      provide: RequestPasswordResetUseCase,
      useFactory: (provider: AuthProvider) =>
        new RequestPasswordResetUseCase(provider),
      inject: [AUTH_PROVIDER],
    },
    {
      provide: ConfirmPasswordResetUseCase,
      useFactory: (provider: AuthProvider) =>
        new ConfirmPasswordResetUseCase(provider),
      inject: [AUTH_PROVIDER],
    },
    {
      provide: BeginOAuthUseCase,
      useFactory: (provider: AuthProvider, allowed: string[]) =>
        new BeginOAuthUseCase(provider, allowed),
      inject: [AUTH_PROVIDER, AUTH_ALLOWED_PROVIDERS],
    },
    {
      provide: CompleteOAuthUseCase,
      useFactory: (provider: AuthProvider, allowed: string[]) =>
        new CompleteOAuthUseCase(provider, allowed),
      inject: [AUTH_PROVIDER, AUTH_ALLOWED_PROVIDERS],
    },
    {
      provide: ValidateSessionUseCase,
      useFactory: (provider: AuthProvider) =>
        new ValidateSessionUseCase(provider),
      inject: [AUTH_PROVIDER],
    },
    OriginValidationMiddleware,
    SessionValidationMiddleware,
  ],
  exports: [
    OriginValidationMiddleware,
    SessionValidationMiddleware,
    ValidateSessionUseCase,
    AUTH_CONFIG,
  ],
})
export class AuthModule {}
