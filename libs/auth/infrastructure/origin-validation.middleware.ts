import {
  ForbiddenException,
  Inject,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AUTH_CONFIG, type AuthConfig } from './auth.config';

@Injectable()
export class OriginValidationMiddleware implements NestMiddleware {
  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}

  use(request: Request, _response: Response, next: NextFunction): void {
    if (!isSafeMethod(request.method)) {
      assertTrustedOrigin(request, this.config.trustedOrigins);
    }

    next();
  }
}

function isSafeMethod(method: string): boolean {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
}

function assertTrustedOrigin(request: Request, trustedOrigins: string[]): void {
  const origin = resolveOrigin(request);
  if (!origin || !trustedOrigins.includes(origin)) {
    throw new ForbiddenException('Untrusted origin');
  }
}

function resolveOrigin(request: Request): string | null {
  const origin = request.headers.origin;
  if (typeof origin === 'string' && origin.length > 0) {
    return origin;
  }

  const referer = request.headers.referer;
  if (typeof referer === 'string' && referer.length > 0) {
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }

  return null;
}
