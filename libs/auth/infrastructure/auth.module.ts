import { Module } from '@nestjs/common';
import type { AuthProvider } from '../application/auth-provider.port';
import { CLOCK, type Clock } from '../application/clock.port';
import {
  IDENTITY_LOOKUP,
  type IdentityLookupPort,
} from '../application/identity-lookup.port';
import {
  REGISTRATION_ACTIVATION,
  type RegistrationActivationPort,
} from '../application/registration-activation.port';
import {
  REGISTRATION_REPOSITORY,
  type PendingRegistrationRepository,
} from '../application/pending-registration.repository';
import {
  VERIFICATION_MAILER,
  type VerificationMailer,
} from '../application/verification-mailer.port';
import {
  VERIFICATION_THROTTLE_REPOSITORY,
  type VerificationThrottleRepository,
} from '../application/verification-throttle.repository';
import { VerificationRateLimitService } from '../application/verification-rate-limit.service';
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
import { ValidateSessionUseCase } from '../application/use-cases/validate-session.use-case';
import { AuthController } from './auth.controller';
import { BetterAuthAdapter } from './better-auth.adapter';
import { SmtpMailSender, createSmtpTransporter } from './mail/smtp-mail.sender';
import { IdentityLookupPrismaAdapter } from './identity-lookup.prisma';
import { RegistrationActivationPrismaAdapter } from './registration-activation.prisma';
import { RegistrationMailer } from './registration-mailer';
import { SystemClock } from './system-clock';
import { OriginValidationMiddleware } from './origin-validation.middleware';
import { SessionValidationMiddleware } from './session-validation.middleware';
import { AuthPrismaService } from './prisma/prisma.service';
import { PendingRegistrationPrismaRepository } from './pending-registration.repository.prisma';
import { VerificationThrottlePrismaRepository } from './verification-throttle.repository.prisma';
import { RegistrationCleanupService } from './registration-cleanup.service';
import {
  AUTH_ALLOWED_PROVIDERS,
  AUTH_CONFIG,
  AUTH_PROVIDER,
  MAIL_PORT,
  SMTP_TRANSPORTER,
  loadAuthConfig,
  type AuthConfig,
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
      provide: SMTP_TRANSPORTER,
      useFactory: (config: AuthConfig) => createSmtpTransporter(config.smtp),
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
    { provide: CLOCK, useClass: SystemClock },
    { provide: IDENTITY_LOOKUP, useClass: IdentityLookupPrismaAdapter },
    { provide: VERIFICATION_MAILER, useClass: RegistrationMailer },
    {
      provide: REGISTRATION_ACTIVATION,
      useClass: RegistrationActivationPrismaAdapter,
    },
    {
      provide: REGISTRATION_REPOSITORY,
      useClass: PendingRegistrationPrismaRepository,
    },
    {
      provide: VERIFICATION_THROTTLE_REPOSITORY,
      useClass: VerificationThrottlePrismaRepository,
    },
    {
      provide: VerificationRateLimitService,
      useFactory: (
        throttle: VerificationThrottleRepository,
        config: AuthConfig,
      ) =>
        new VerificationRateLimitService(throttle, config.verificationLimits),
      inject: [VERIFICATION_THROTTLE_REPOSITORY, AUTH_CONFIG],
    },
    {
      provide: StartRegistrationUseCase,
      useFactory: (
        registrations: PendingRegistrationRepository,
        rateLimit: VerificationRateLimitService,
        identityLookup: IdentityLookupPort,
        mailer: VerificationMailer,
        clock: Clock,
      ) =>
        new StartRegistrationUseCase(
          registrations,
          rateLimit,
          identityLookup,
          mailer,
          clock,
        ),
      inject: [
        REGISTRATION_REPOSITORY,
        VerificationRateLimitService,
        IDENTITY_LOOKUP,
        VERIFICATION_MAILER,
        CLOCK,
      ],
    },
    {
      provide: ResendVerificationUseCase,
      useFactory: (
        registrations: PendingRegistrationRepository,
        rateLimit: VerificationRateLimitService,
        identityLookup: IdentityLookupPort,
        mailer: VerificationMailer,
        clock: Clock,
      ) =>
        new ResendVerificationUseCase(
          registrations,
          rateLimit,
          identityLookup,
          mailer,
          clock,
        ),
      inject: [
        REGISTRATION_REPOSITORY,
        VerificationRateLimitService,
        IDENTITY_LOOKUP,
        VERIFICATION_MAILER,
        CLOCK,
      ],
    },
    {
      provide: CompleteSignUpUseCase,
      useFactory: (
        activation: RegistrationActivationPort,
        provider: AuthProvider,
        rateLimit: VerificationRateLimitService,
        clock: Clock,
      ) => new CompleteSignUpUseCase(activation, provider, rateLimit, clock),
      inject: [
        REGISTRATION_ACTIVATION,
        AUTH_PROVIDER,
        VerificationRateLimitService,
        CLOCK,
      ],
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
    RegistrationCleanupService,
  ],
  exports: [
    OriginValidationMiddleware,
    SessionValidationMiddleware,
    ValidateSessionUseCase,
    AUTH_CONFIG,
  ],
})
export class AuthModule {}
