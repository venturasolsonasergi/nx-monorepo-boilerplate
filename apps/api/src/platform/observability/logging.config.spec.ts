import type { IncomingMessage, ServerResponse } from 'node:http';
import pino from 'pino';
import {
  DEFAULT_LOG_LEVEL,
  PRODUCTION_LOG_LEVEL,
  buildPinoHttpOptions,
  buildPinoOptions,
  createLoggerParams,
  resolveEnvironment,
  resolveLogLevel,
} from './logging.config';

interface MemoryStream {
  write(chunk: string): void;
}

function createCapture(): {
  stream: MemoryStream;
  output: () => string;
  records: () => Record<string, unknown>[];
} {
  const chunks: string[] = [];
  return {
    stream: {
      write(chunk: string): void {
        chunks.push(chunk);
      },
    },
    output: () => chunks.join(''),
    records: () =>
      chunks
        .join('')
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

function makeRequest(method: string, route: string): IncomingMessage {
  return {
    method,
    route: { path: route },
    originalUrl: route,
  } as unknown as IncomingMessage;
}

function makeResponse(statusCode: number): ServerResponse {
  return { statusCode } as unknown as ServerResponse;
}

function emitLog(
  logger: pino.Logger,
  level: string,
  message: string,
  props: Record<string, unknown> = {},
): void {
  if (level === 'debug') {
    logger.debug(props, message);
  } else if (level === 'info') {
    logger.info(props, message);
  } else if (level === 'warn') {
    logger.warn(props, message);
  } else if (level === 'error') {
    logger.error(props, message);
  }
}

describe('logging configuration', () => {
  describe('environment', () => {
    it('defaults to development when NODE_ENV is unset', () => {
      expect(resolveEnvironment({})).toBe('development');
      expect(resolveEnvironment({ NODE_ENV: '   ' })).toBe('development');
    });

    it('uses NODE_ENV when present', () => {
      expect(resolveEnvironment({ NODE_ENV: 'production' })).toBe('production');
    });
  });

  describe('level', () => {
    it('defaults to warn in production', () => {
      expect(resolveLogLevel({ NODE_ENV: 'production' })).toBe(
        PRODUCTION_LOG_LEVEL,
      );
    });

    it('defaults to info outside production', () => {
      expect(resolveLogLevel({ NODE_ENV: 'development' })).toBe(
        DEFAULT_LOG_LEVEL,
      );
      expect(resolveLogLevel({})).toBe(DEFAULT_LOG_LEVEL);
    });

    it('lets LOG_LEVEL override the environment default everywhere', () => {
      expect(
        resolveLogLevel({ NODE_ENV: 'production', LOG_LEVEL: 'debug' }),
      ).toBe('debug');
      expect(
        resolveLogLevel({ NODE_ENV: 'development', LOG_LEVEL: 'error' }),
      ).toBe('error');
    });

    it('ignores unsupported LOG_LEVEL values', () => {
      expect(
        resolveLogLevel({ NODE_ENV: 'production', LOG_LEVEL: 'verbose' }),
      ).toBe(PRODUCTION_LOG_LEVEL);
    });
  });

  describe('base fields', () => {
    it('identifies the API process and environment', () => {
      expect(buildPinoOptions({ NODE_ENV: 'production' }).base).toEqual({
        service: 'api',
        environment: 'production',
      });
      expect(buildPinoOptions({}).base).toEqual({
        service: 'api',
        environment: 'development',
      });
    });
  });

  describe('level filtering', () => {
    it('suppresses debug entries at the default development level', () => {
      const capture = createCapture();
      const logger = pino(
        buildPinoOptions({ NODE_ENV: 'development' }),
        capture.stream,
      );

      logger.debug('debug-entry');
      logger.info('info-entry');
      logger.warn('warn-entry');

      const output = capture.output();
      expect(output).not.toContain('debug-entry');
      expect(output).toContain('info-entry');
      expect(output).toContain('warn-entry');
    });

    it('suppresses informational entries at the default production level', () => {
      const capture = createCapture();
      const logger = pino(
        buildPinoOptions({ NODE_ENV: 'production' }),
        capture.stream,
      );

      logger.info('info-entry');
      logger.warn('warn-entry');
      logger.error('error-entry');

      const output = capture.output();
      expect(output).not.toContain('info-entry');
      expect(output).toContain('warn-entry');
      expect(output).toContain('error-entry');
    });
  });

  describe('output format', () => {
    it('keeps the same entry fields across development and production', () => {
      const development = buildPinoOptions({ NODE_ENV: 'development' });
      const production = buildPinoOptions({ NODE_ENV: 'production' });

      expect(Object.keys(development).sort()).toEqual(
        Object.keys(production).sort(),
      );
      expect(development.redact).toEqual(production.redact);
      expect(Object.keys(development.serializers ?? {}).sort()).toEqual(
        Object.keys(production.serializers ?? {}).sort(),
      );
      expect(development.base).toEqual({
        service: 'api',
        environment: 'development',
      });
      expect(production.base).toEqual({
        service: 'api',
        environment: 'production',
      });
    });

    it('uses pino-pretty only outside production and only without a destination', () => {
      expect(
        buildPinoHttpOptions({ NODE_ENV: 'development' }).transport,
      ).toMatchObject({ target: 'pino-pretty' });
      expect(
        buildPinoHttpOptions({ NODE_ENV: 'production' }).transport,
      ).toBeUndefined();
    });

    it('writes structured JSON for both environments when a destination is supplied', () => {
      for (const nodeEnv of ['development', 'production']) {
        const capture = createCapture();
        const params = createLoggerParams(
          { NODE_ENV: nodeEnv, LOG_LEVEL: 'info' },
          capture.stream,
        );
        const [options] = params.pinoHttp as [pino.LoggerOptions, MemoryStream];
        const logger = pino(options, capture.stream);

        logger.info('hello');

        const [record] = capture.records();
        expect(record).toMatchObject({
          service: 'api',
          environment: nodeEnv,
          msg: 'hello',
        });
      }
    });
  });

  describe('request outcome logging', () => {
    const sessionProbe = '/auth/refresh';

    it('classifies the expected anonymous session probe as debug, not a warning', () => {
      const http = buildPinoHttpOptions({ NODE_ENV: 'development' });
      const request = makeRequest('POST', sessionProbe);

      expect(http.customLogLevel?.(request, makeResponse(401))).toBe('debug');
    });

    it('treats the expected outcome message as a non-failure for both hooks', () => {
      const http = buildPinoHttpOptions({ NODE_ENV: 'development' });
      const request = makeRequest('POST', sessionProbe);
      const response = makeResponse(401);

      expect(http.customSuccessMessage?.(request, response, 1)).toBe(
        'anonymous session probe',
      );
      expect(
        http.customErrorMessage?.(request, response, new Error('x'), 1),
      ).toBe('anonymous session probe');
    });

    it('keeps a genuine 4xx at warn with the failure message', () => {
      const http = buildPinoHttpOptions({ NODE_ENV: 'development' });
      const request = makeRequest('POST', '/auth/login');
      const response = makeResponse(401);

      expect(http.customLogLevel?.(request, response)).toBe('warn');
      expect(http.customSuccessMessage?.(request, response, 1)).toBe(
        'http request failed',
      );
    });

    it('keeps 5xx at error and successful responses silent', () => {
      const http = buildPinoHttpOptions({ NODE_ENV: 'development' });
      const request = makeRequest('POST', sessionProbe);

      expect(http.customLogLevel?.(request, makeResponse(500))).toBe('error');
      expect(http.customLogLevel?.(request, makeResponse(204))).toBe('silent');
    });

    it('emits the probe as a debug record that does not describe a failure', () => {
      const env = { NODE_ENV: 'development', LOG_LEVEL: 'debug' };
      const capture = createCapture();
      const logger = pino(buildPinoOptions(env), capture.stream);
      const http = buildPinoHttpOptions(env);
      const request = makeRequest('POST', sessionProbe);
      const response = makeResponse(401);

      const level = http.customLogLevel?.(request, response) ?? 'silent';
      const message = http.customSuccessMessage?.(request, response, 1) ?? '';
      const props = {
        ...http.customProps?.(request, response),
        ...http.customSuccessObject?.(request, response, undefined),
      };
      emitLog(logger, level, message, props);

      const [record] = capture.records();
      expect(record).toMatchObject({
        level: 20,
        module: 'auth',
        msg: 'anonymous session probe',
        http: { method: 'POST', route: sessionProbe, statusCode: 401 },
      });
    });

    it('emits a genuine 4xx as a warn failure record', () => {
      const env = { NODE_ENV: 'development', LOG_LEVEL: 'debug' };
      const capture = createCapture();
      const logger = pino(buildPinoOptions(env), capture.stream);
      const http = buildPinoHttpOptions(env);
      const request = makeRequest('POST', '/auth/login');
      const response = makeResponse(401);

      const level = http.customLogLevel?.(request, response) ?? 'silent';
      const message =
        http.customErrorMessage?.(request, response, new Error('x'), 1) ?? '';
      const props = {
        ...http.customProps?.(request, response),
        ...http.customErrorObject?.(request, response, new Error('x')),
      };
      emitLog(logger, level, message, props);

      const [record] = capture.records();
      expect(record).toMatchObject({
        level: 40,
        module: 'auth',
        msg: 'http request failed',
        http: { method: 'POST', route: '/auth/login', statusCode: 401 },
      });
    });
  });
});
