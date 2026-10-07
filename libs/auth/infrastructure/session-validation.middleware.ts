import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NestMiddleware,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ValidateSessionUseCase } from '../application/use-cases/validate-session.use-case';
import {
  AuthProviderError,
  RateLimitedError,
} from '../application/auth.errors';
import { readCookieHeader } from './session-cookie';
import { AUTH_CONFIG, type AuthConfig } from './auth.config';
import { sourceIpFromRequest } from './source-ip';

export interface AuthenticatedRequest extends Request {
  authUserId?: string;
  authEmailVerified?: boolean;
}

@Injectable()
export class SessionValidationMiddleware implements NestMiddleware {
  constructor(
    @Inject(ValidateSessionUseCase)
    private readonly validateSession: ValidateSessionUseCase,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  async use(
    request: AuthenticatedRequest,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    let session;
    try {
      session = await this.validateSession.execute(readCookieHeader(request), {
        sourceIp: sourceIpFromRequest(request, this.config.trustedProxies),
      });
    } catch (error) {
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

    if (session) {
      request.authUserId = session.userId;
      request.authEmailVerified = session.emailVerified;
    }

    next();
  }
}
