import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';

interface HttpErrorBody {
  statusCode: number;
  message: string;
}

function exceptionBody(exception: HttpException): unknown {
  const response = exception.getResponse();
  if (typeof response === 'object' && response !== null) {
    return response;
  }

  const errorCode = (exception as { errorCode?: string }).errorCode;
  return {
    statusCode: exception.getStatus(),
    message: response,
    ...(errorCode !== undefined ? { errorCode } : {}),
  };
}

function httpErrorBody(exception: unknown): HttpErrorBody | null {
  if (!exception || typeof exception !== 'object') {
    return null;
  }

  const candidate = exception as {
    statusCode?: unknown;
    message?: unknown;
  };
  if (
    Number.isInteger(candidate.statusCode) &&
    (candidate.statusCode as number) >= 400 &&
    (candidate.statusCode as number) < 600 &&
    typeof candidate.message === 'string' &&
    candidate.message !== ''
  ) {
    return {
      statusCode: candidate.statusCode as number,
      message: candidate.message,
    };
  }

  return null;
}

/**
 * Global exception filter for the API host. It records unexpected exceptions on
 * the response object so the single request-completion logging path can
 * serialize them, and it writes the standard Nest error response without
 * emitting its own log record. This keeps exactly one operational failure
 * record per failed request and preserves the existing HTTP error contracts.
 */
@Catch()
export class OperationalExceptionFilter implements ExceptionFilter {
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const adapter = this.adapterHost.httpAdapter;
    if (!adapter) {
      return;
    }

    const response = host.switchToHttp().getResponse<unknown>();
    const fail = (body: unknown, statusCode: number): void => {
      if (!adapter.isHeadersSent(response)) {
        adapter.reply(response, body, statusCode);
      } else {
        adapter.end(response);
      }
    };

    if (exception instanceof HttpException) {
      fail(exceptionBody(exception), exception.getStatus());
      return;
    }

    (response as { err?: unknown }).err = exception;

    const httpError = httpErrorBody(exception);
    if (httpError) {
      fail(httpError, httpError.statusCode);
      return;
    }

    fail(
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
