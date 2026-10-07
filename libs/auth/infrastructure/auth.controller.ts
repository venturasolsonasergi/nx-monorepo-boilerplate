import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { formatZodValidationErrors } from '@app/shared/validation/zod-validation-error';
import { MIN_PASSWORD_LENGTH } from '../domain/password.vo';
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
  InvalidPasswordError,
  InvalidResetTokenError,
  InvalidSessionError,
  InvalidVerificationTokenError,
  RateLimitedError,
  RegistrationConflictError,
  SourceBlockedError,
  UnsupportedProviderError,
  UntrustedRedirectError,
  UnverifiedEmailError,
} from '../application/auth.errors';
import { AUTH_CONFIG, type AuthConfig } from './auth.config';
import { readCookieHeader } from './session-cookie';
import { sourceIpFromRequest } from './source-ip';
import type { RequestContext } from '../application/request-context';

const startRegistrationSchema = z
  .object({
    email: z.string().trim().min(1).email(),
  })
  .strict();

const resendVerificationSchema = z
  .object({
    email: z.string().trim().min(1).email(),
  })
  .strict();

const completeSignUpSchema = z
  .object({
    token: z.string().trim().min(1),
    password: z.string().min(MIN_PASSWORD_LENGTH),
  })
  .strict();

const loginSchema = z
  .object({
    email: z.string().trim().min(1).email(),
    password: z.string().min(1),
  })
  .strict();

const requestResetSchema = z
  .object({
    email: z.string().trim().min(1).email(),
  })
  .strict();

const confirmResetSchema = z
  .object({
    token: z.string().trim().min(1),
    password: z.string().min(MIN_PASSWORD_LENGTH),
  })
  .strict();

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(StartRegistrationUseCase)
    private readonly startRegistrationUseCase: StartRegistrationUseCase,
    @Inject(ResendVerificationUseCase)
    private readonly resendVerificationUseCase: ResendVerificationUseCase,
    @Inject(CompleteSignUpUseCase)
    private readonly completeSignUpUseCase: CompleteSignUpUseCase,
    @Inject(LoginUseCase) private readonly loginUseCase: LoginUseCase,
    @Inject(LogoutUseCase) private readonly logoutUseCase: LogoutUseCase,
    @Inject(RefreshSessionUseCase)
    private readonly refreshSessionUseCase: RefreshSessionUseCase,
    @Inject(RequestPasswordResetUseCase)
    private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
    @Inject(ConfirmPasswordResetUseCase)
    private readonly confirmPasswordResetUseCase: ConfirmPasswordResetUseCase,
    @Inject(BeginOAuthUseCase)
    private readonly beginOAuthUseCase: BeginOAuthUseCase,
    @Inject(CompleteOAuthUseCase)
    private readonly completeOAuthUseCase: CompleteOAuthUseCase,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  @Get('public-config')
  publicConfig() {
    return { supportEmail: this.config.supportEmail };
  }

  @Post('signup')
  @HttpCode(201)
  async signUp(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const input = this.parse(startRegistrationSchema, body);

    try {
      return await this.startRegistrationUseCase.execute(
        input,
        this.contextFrom(request),
      );
    } catch (error) {
      if (error instanceof EmailAlreadyExistsError) {
        throw new ConflictException('Email already exists');
      }

      if (error instanceof SourceBlockedError) {
        response.setHeader('Retry-After', String(error.retryAfterSeconds));
        throw new HttpException(
          {
            statusCode: 429,
            message: 'Too Many Requests',
            error: 'Too Many Requests',
            retryAfterSeconds: error.retryAfterSeconds,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw error;
    }
  }

  @Post('verification/resend')
  @HttpCode(200)
  async resendVerification(@Body() body: unknown, @Req() request: Request) {
    const input = this.parse(resendVerificationSchema, body);
    return this.resendVerificationUseCase.execute(
      input,
      this.contextFrom(request),
    );
  }

  @Post('signup/complete')
  @HttpCode(200)
  async completeSignUp(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const input = this.parse(completeSignUpSchema, body);

    try {
      const result = await this.completeSignUpUseCase.execute(
        input,
        this.contextFrom(request),
      );
      this.applyCookies(response, result.setCookie);
      return { userId: result.userId, status: result.status };
    } catch (error) {
      if (
        error instanceof InvalidVerificationTokenError ||
        error instanceof InvalidPasswordError
      ) {
        throw new BadRequestException(this.invalidToken());
      }

      if (error instanceof RegistrationConflictError) {
        throw new ConflictException('Registration conflict');
      }

      if (error instanceof SourceBlockedError) {
        response.setHeader('Retry-After', String(error.retryAfterSeconds));
        throw new HttpException(
          {
            statusCode: 429,
            message: 'Too Many Requests',
            error: 'Too Many Requests',
            retryAfterSeconds: error.retryAfterSeconds,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (error instanceof ActivationCommittedError) {
        if (error.sessionError instanceof RateLimitedError) {
          response.setHeader(
            'Retry-After',
            String(error.sessionError.retryAfterSeconds),
          );
          throw new HttpException(
            {
              statusCode: 429,
              message: 'Too Many Requests',
              error: 'Too Many Requests',
              retryAfterSeconds: error.sessionError.retryAfterSeconds,
              accountActivated: true,
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

        throw new ServiceUnavailableException({
          statusCode: 503,
          message: 'Service Unavailable',
          error: 'Service Unavailable',
          accountActivated: true,
        });
      }

      this.rethrowProviderFailure(response, error);
    }
  }

  @Post('verify-email')
  @HttpCode(410)
  retiredVerifyEmail() {
    return {
      statusCode: 410,
      message: 'Verification endpoint retired',
      error: 'Gone',
    };
  }

  @Get('verify-email')
  verifyEmailLink(
    @Query('token') token: string | undefined,
    @Res() response: Response,
  ) {
    const target = new URL('/complete-signup', this.config.webURL);
    target.searchParams.set('token', token ?? '');
    response.redirect(302, target.toString());
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const input = this.parse(loginSchema, body);

    try {
      const result = await this.loginUseCase.execute(
        input,
        this.contextFrom(request),
      );
      this.applyCookies(response, result.setCookie);
      return { userId: result.session.userId, status: result.status };
    } catch (error) {
      if (
        error instanceof InvalidCredentialsError ||
        error instanceof UnverifiedEmailError
      ) {
        throw new UnauthorizedException('Invalid credentials');
      }

      this.rethrowProviderFailure(response, error);
    }
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.logoutUseCase.execute(
      readCookieHeader(request),
      this.contextFrom(request),
    );
    this.applyCookies(response, result.setCookie);
    return { status: result.status };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const result = await this.refreshSessionUseCase.execute(
        readCookieHeader(request),
        this.contextFrom(request),
      );
      this.applyCookies(response, result.setCookie);
      return { userId: result.userId, status: result.status };
    } catch (error) {
      if (error instanceof InvalidSessionError) {
        throw new UnauthorizedException('Invalid session');
      }

      this.rethrowProviderFailure(response, error);
    }
  }

  @Post('reset-password/request')
  @HttpCode(200)
  async requestPasswordReset(@Body() body: unknown, @Req() request: Request) {
    const input = this.parse(requestResetSchema, body);
    return this.requestPasswordResetUseCase.execute(
      input,
      this.contextFrom(request),
    );
  }

  @Post('reset-password/confirm')
  @HttpCode(200)
  async confirmPasswordReset(@Body() body: unknown, @Req() request: Request) {
    const input = this.parse(confirmResetSchema, body);

    try {
      return await this.confirmPasswordResetUseCase.execute(
        input,
        this.contextFrom(request),
      );
    } catch (error) {
      if (error instanceof InvalidResetTokenError) {
        throw new BadRequestException(this.invalidToken());
      }

      throw error;
    }
  }

  @Get('reset-password/confirm')
  resetPasswordLink(
    @Query('token') token: string | undefined,
    @Query('redirectTo') redirectTo: string | undefined,
    @Res() response: Response,
  ) {
    const target = this.safeWebTarget(redirectTo, '/reset-password');
    response.redirect(302, this.appendQuery(target, { token: token ?? '' }));
  }

  @Post('oauth/:provider')
  @HttpCode(200)
  async startOAuth(
    @Param('provider') provider: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const { authorizationUrl, setCookie } =
        await this.beginOAuthUseCase.execute(
          {
            provider,
            callbackURL: this.webDestination(),
          },
          this.contextFrom(request),
        );

      this.applyCookies(response, setCookie);
      return { provider, authorizationUrl };
    } catch (error) {
      if (error instanceof UnsupportedProviderError) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'Validation failed',
          error: 'Bad Request',
          details: [
            {
              field: 'provider',
              code: 'invalid_format',
              message: 'provider is not configured',
            },
          ],
        });
      }

      throw error;
    }
  }

  @Get('callback/:provider')
  async completeOAuth(
    @Param('provider') provider: string,
    @Query() query: Record<string, string>,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    try {
      const result = await this.completeOAuthUseCase.execute({
        provider,
        query: pickStrings(query),
        cookieHeader: readCookieHeader(request),
        context: this.contextFrom(request),
      });
      this.applyCookies(response, result.setCookie);
      response.redirect(302, result.redirectUrl);
    } catch (error) {
      if (error instanceof UnsupportedProviderError) {
        throw new BadRequestException(this.invalidOAuthProvider());
      }

      const errorCode =
        error instanceof UnverifiedEmailError
          ? 'email_not_verified'
          : 'oauth_failed';

      if (
        error instanceof AuthProviderError ||
        error instanceof UntrustedRedirectError ||
        error instanceof UnverifiedEmailError
      ) {
        response.redirect(
          302,
          this.appendQuery(
            this.safeWebTarget(undefined, '/auth/oauth/callback'),
            { error: errorCode },
          ),
        );
        return;
      }

      throw error;
    }
  }

  private contextFrom(request: Request): RequestContext {
    return {
      sourceIp: sourceIpFromRequest(request, this.config.trustedProxies),
    };
  }

  private rethrowProviderFailure(response: Response, error: unknown): never {
    if (error instanceof RateLimitedError) {
      response.setHeader('Retry-After', String(error.retryAfterSeconds));
      throw new HttpException(
        {
          statusCode: 429,
          message: 'Too Many Requests',
          error: 'Too Many Requests',
          retryAfterSeconds: error.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (error instanceof AuthProviderError) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        message: 'Service Unavailable',
        error: 'Service Unavailable',
      });
    }

    throw error;
  }

  private parse<T>(schema: z.ZodType<T>, body: unknown): T {
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        details: formatZodValidationErrors(parsed.error),
      });
    }

    return parsed.data;
  }

  private applyCookies(response: Response, setCookie: string[]): void {
    if (setCookie.length > 0) {
      response.setHeader('Set-Cookie', setCookie);
    }
  }

  private webDestination(): string {
    return new URL('/auth/oauth/callback', this.config.webURL).toString();
  }

  private safeWebTarget(
    candidate: string | undefined,
    fallbackPath: string,
  ): string {
    const fallback = `${this.config.webURL}${fallbackPath}`;
    if (!candidate) {
      return fallback;
    }

    try {
      const url = new URL(candidate);
      return this.config.trustedOrigins.includes(url.origin)
        ? url.toString()
        : fallback;
    } catch {
      return fallback;
    }
  }

  private appendQuery(target: string, params: Record<string, string>): string {
    const url = new URL(target);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    return url.toString();
  }

  private invalidToken() {
    return {
      statusCode: 400,
      message: 'Validation failed',
      error: 'Bad Request',
      details: [
        {
          field: 'token',
          code: 'invalid_format',
          message: 'token is invalid or expired',
        },
      ],
    };
  }

  private invalidOAuthProvider() {
    return {
      statusCode: 400,
      message: 'Validation failed',
      error: 'Bad Request',
      details: [
        {
          field: 'provider',
          code: 'invalid_format',
          message: 'provider is not configured',
        },
      ],
    };
  }
}

function pickStrings(query: Record<string, unknown>): Record<string, string> {
  const strings: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') {
      strings[key] = value;
    }
  }

  return strings;
}
