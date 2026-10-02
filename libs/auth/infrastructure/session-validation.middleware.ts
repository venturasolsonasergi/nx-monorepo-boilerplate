import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ValidateSessionUseCase } from '../application/use-cases/validate-session.use-case';
import { readCookieHeader } from './session-cookie';

export interface AuthenticatedRequest extends Request {
  authUserId?: string;
  authEmailVerified?: boolean;
}

@Injectable()
export class SessionValidationMiddleware implements NestMiddleware {
  constructor(
    @Inject(ValidateSessionUseCase)
    private readonly validateSession: ValidateSessionUseCase,
  ) {}

  async use(
    request: AuthenticatedRequest,
    _response: Response,
    next: NextFunction,
  ): Promise<void> {
    const session = await this.validateSession.execute(
      readCookieHeader(request),
    );
    if (session) {
      request.authUserId = session.userId;
      request.authEmailVerified = session.emailVerified;
    }

    next();
  }
}
