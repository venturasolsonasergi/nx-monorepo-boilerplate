import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DestinationStream, LoggerOptions } from 'pino';
import type { Params } from 'nestjs-pino';
import { moduleForRequest, routeTemplate } from './module-context';
import { redactionOptions, scrubSerializedLine } from './redaction';
import { REQUEST_ID_HEADER, resolveRequestId } from './request-id';

export const LOG_SERVICE = 'api';
export const DEFAULT_LOG_LEVEL = 'info';
export const PRODUCTION_LOG_LEVEL = 'warn';

export const SUPPORTED_LOG_LEVELS = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
  'silent',
] as const;

export interface LoggerEnvironment {
  NODE_ENV?: string;
  LOG_LEVEL?: string;
}

interface PinoHttpOptions extends LoggerOptions {
  autoLogging?: boolean;
  genReqId?: (request: IncomingMessage, response: ServerResponse) => string;
  customAttributeKeys?: { reqId?: string };
  customProps?: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => Record<string, unknown>;
  customLogLevel?: (
    request: IncomingMessage,
    response: ServerResponse,
    error?: Error,
  ) => string;
  customSuccessObject?: (
    request: IncomingMessage,
    response: ServerResponse,
    value: unknown,
  ) => Record<string, unknown>;
  customErrorObject?: (
    request: IncomingMessage,
    response: ServerResponse,
    error: Error,
    value: unknown,
  ) => Record<string, unknown>;
  customSuccessMessage?: (
    request: IncomingMessage,
    response: ServerResponse,
    responseTime: number,
  ) => string;
  customErrorMessage?: (
    request: IncomingMessage,
    response: ServerResponse,
    error: Error,
    responseTime: number,
  ) => string;
}

export function resolveEnvironment(
  env: LoggerEnvironment = process.env,
): string {
  const value = env.NODE_ENV?.trim();
  return value && value.length > 0 ? value : 'development';
}

export function resolveLogLevel(env: LoggerEnvironment = process.env): string {
  const configured = env.LOG_LEVEL?.trim();
  if (
    configured &&
    (SUPPORTED_LOG_LEVELS as readonly string[]).includes(configured)
  ) {
    return configured;
  }

  return resolveEnvironment(env) === 'production'
    ? PRODUCTION_LOG_LEVEL
    : DEFAULT_LOG_LEVEL;
}

export function buildPinoOptions(
  env: LoggerEnvironment = process.env,
): LoggerOptions {
  return {
    level: resolveLogLevel(env),
    base: {
      service: LOG_SERVICE,
      environment: resolveEnvironment(env),
    },
    redact: redactionOptions(),
    serializers: {
      req: () => undefined,
      res: () => undefined,
    },
    hooks: {
      streamWrite: (line: string) => scrubSerializedLine(line),
    },
  };
}

function toRequestId(id: unknown): string {
  if (typeof id === 'string') {
    return id;
  }
  if (typeof id === 'number') {
    return String(id);
  }
  return '';
}

function httpFields(
  request: IncomingMessage,
  response: ServerResponse,
): Record<string, unknown> {
  const route = routeTemplate(request);
  return {
    method: request.method ?? 'UNKNOWN',
    ...(route ? { route } : {}),
    statusCode: response.statusCode,
  };
}

const SESSION_PROBE_ROUTE = '/auth/refresh';
const FAILURE_MESSAGE = 'http request failed';
const EXPECTED_OUTCOME_MESSAGE = 'anonymous session probe';

/**
 * The web client probes `POST /auth/refresh` to discover whether a session
 * exists; a `401` is the normal answer for an anonymous visitor, not a failed
 * request. Only that specific, stable outcome is treated as expected.
 */
function isExpectedAnonymousSessionProbe(
  request: IncomingMessage,
  response: ServerResponse,
): boolean {
  return (
    request.method === 'POST' &&
    response.statusCode === 401 &&
    routeTemplate(request) === SESSION_PROBE_ROUTE
  );
}

export function buildPinoHttpOptions(
  env: LoggerEnvironment = process.env,
  pretty = resolveEnvironment(env) !== 'production',
): PinoHttpOptions {
  const options: PinoHttpOptions = {
    ...buildPinoOptions(env),
    autoLogging: true,
    genReqId: (request, response) => {
      const resolved = resolveRequestId(request.headers[REQUEST_ID_HEADER]);
      response.setHeader(REQUEST_ID_HEADER, resolved);
      return resolved;
    },
    customAttributeKeys: { reqId: 'requestId' },
    customProps: (request) => ({
      requestId: toRequestId(request.id),
      module: moduleForRequest(request),
    }),
    customLogLevel: (request, response) => {
      if (response.statusCode >= 500) {
        return 'error';
      }
      if (response.statusCode >= 400) {
        return isExpectedAnonymousSessionProbe(request, response)
          ? 'debug'
          : 'warn';
      }
      return 'silent';
    },
    customSuccessObject: (request, response) => ({
      http: httpFields(request, response),
    }),
    customErrorObject: (request, response, error) => ({
      http: httpFields(request, response),
      ...(error ? { err: error } : {}),
    }),
    customSuccessMessage: (request, response) =>
      isExpectedAnonymousSessionProbe(request, response)
        ? EXPECTED_OUTCOME_MESSAGE
        : FAILURE_MESSAGE,
    customErrorMessage: (request, response) =>
      isExpectedAnonymousSessionProbe(request, response)
        ? EXPECTED_OUTCOME_MESSAGE
        : FAILURE_MESSAGE,
  };

  if (pretty) {
    options.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        singleLine: false,
      },
    };
  }

  return options;
}

export function createLoggerParams(
  env: LoggerEnvironment = process.env,
  destination?: DestinationStream,
): Params {
  const pretty =
    destination === undefined && resolveEnvironment(env) !== 'production';
  const options = buildPinoHttpOptions(env, pretty);
  const pinoHttp = destination ? [options, destination] : options;

  return { pinoHttp: pinoHttp as Params['pinoHttp'] };
}
