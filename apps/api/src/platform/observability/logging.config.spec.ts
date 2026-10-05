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
});
