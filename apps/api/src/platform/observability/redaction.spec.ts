import type { IncomingMessage, ServerResponse } from 'node:http';
import pino from 'pino';
import { buildPinoHttpOptions, buildPinoOptions } from './logging.config';
import {
  REDACTION_CENSOR,
  redactValue,
  redactionOptions,
  sensitivePaths,
} from './redaction';

interface MemoryStream {
  write(chunk: string): void;
}

function capture(): { stream: MemoryStream; output: () => string } {
  const chunks: string[] = [];
  return {
    stream: {
      write(chunk: string): void {
        chunks.push(chunk);
      },
    },
    output: () => chunks.join(''),
  };
}

function requestLike(overrides: Record<string, unknown> = {}): IncomingMessage {
  return {
    method: 'POST',
    url: '/users',
    headers: {},
    ...overrides,
  } as unknown as IncomingMessage;
}

function responseLike(statusCode: number): ServerResponse {
  return { statusCode } as unknown as ServerResponse;
}

describe('sensitive data redaction', () => {
  const sentinels = [
    'SENTINEL-TOKEN',
    'SENTINEL-CREDENTIAL',
    'SENTINEL-CARD',
    'SENTINEL-CSC',
    'SENTINEL-AUTH-HEADER',
    'SENTINEL-COOKIE',
    'SENTINEL-SET-COOKIE',
    'SENTINEL-NESTED-SECRET',
    'SENTINEL-PASSWORD',
    'SENTINEL-ERR-CARD',
  ];

  function sentinelPayload() {
    const error = new Error('request failed');
    Object.assign(error, {
      password: 'SENTINEL-PASSWORD',
      cardNumber: 'SENTINEL-ERR-CARD',
    });

    return {
      token: 'SENTINEL-TOKEN',
      auth: { credential: 'SENTINEL-CREDENTIAL' },
      payment: {
        cardNumber: 'SENTINEL-CARD',
        cardSecurityCode: 'SENTINEL-CSC',
      },
      headers: {
        authorization: 'SENTINEL-AUTH-HEADER',
        cookie: 'SENTINEL-COOKIE',
        'set-cookie': 'SENTINEL-SET-COOKIE',
      },
      nested: { secret: 'SENTINEL-NESTED-SECRET' },
      err: error,
    };
  }

  it('lists the expected redaction paths', () => {
    const paths = sensitivePaths();
    expect(paths).toEqual(
      expect.arrayContaining([
        'authorization',
        'cookie',
        '["set-cookie"]',
        'token',
        '*.password',
        '*.cardNumber',
        '*.cardSecurityCode',
        'req.headers.authorization',
        'res.headers["set-cookie"]',
      ]),
    );
    expect(redactionOptions().censor).toBe(REDACTION_CENSOR);
  });

  it.each(['development', 'production'])(
    'removes every sentinel and emits the censor marker in %s',
    (nodeEnv) => {
      const output = capture();
      const logger = pino(
        buildPinoOptions({ NODE_ENV: nodeEnv, LOG_LEVEL: 'info' }),
        output.stream,
      );

      logger.info(sentinelPayload(), 'operational entry');

      const text = output.output();
      for (const sentinel of sentinels) {
        expect(text).not.toContain(sentinel);
      }
      expect(text).toContain(REDACTION_CENSOR);
    },
  );

  it('redacts a sensitive field nested beyond the path depth', () => {
    const output = capture();
    const logger = pino(
      buildPinoOptions({ NODE_ENV: 'production', LOG_LEVEL: 'info' }),
      output.stream,
    );

    logger.info(
      {
        level1: {
          level2: {
            level3: {
              level4: { password: 'DEEP-PASSWORD', cardNumber: 'DEEP-CARD' },
            },
          },
        },
      },
      'deep entry',
    );

    const text = output.output();
    expect(text).not.toContain('DEEP-PASSWORD');
    expect(text).not.toContain('DEEP-CARD');
    expect(text).toContain(REDACTION_CENSOR);
  });

  it('scrubs secrets embedded in free-form error messages and stacks', () => {
    const output = capture();
    const logger = pino(
      buildPinoOptions({ NODE_ENV: 'production', LOG_LEVEL: 'info' }),
      output.stream,
    );
    const error = new Error(
      'authentication failed for password=ERROR_MESSAGE_SECRET',
    );
    error.stack = [
      'Error: authentication failed for password=ERROR_MESSAGE_SECRET',
      '    at login (auth.ts:1:1) token=STACK_TOKEN_VALUE',
    ].join('\n');

    logger.error({ err: error }, 'request failed');

    const text = output.output();
    expect(text).not.toContain('ERROR_MESSAGE_SECRET');
    expect(text).not.toContain('STACK_TOKEN_VALUE');
    expect(text).toContain('password=[Redacted]');
    expect(text).toContain('token=[Redacted]');
  });

  it('redacts secrets delivered through deep child bindings', () => {
    const output = capture();
    const logger = pino(
      buildPinoOptions({ NODE_ENV: 'production', LOG_LEVEL: 'info' }),
      output.stream,
    );

    logger
      .child({
        a: { b: { c: { d: { password: 'BINDING-DEEP-PASSWORD' } } } },
      })
      .info('binding entry');

    expect(output.output()).not.toContain('BINDING-DEEP-PASSWORD');
    expect(output.output()).toContain(REDACTION_CENSOR);
  });

  it('scrubs free-form secrets in ordinary fields of child bindings', () => {
    const output = capture();
    const logger = pino(
      buildPinoOptions({ NODE_ENV: 'production', LOG_LEVEL: 'info' }),
      output.stream,
    );

    logger
      .child({ note: 'password=BINDING_TEXT_SECRET' })
      .info('binding text entry');

    const text = output.output();
    expect(text).not.toContain('BINDING_TEXT_SECRET');
    expect(text).toContain('password=[Redacted]');
  });

  it('keeps JSON valid and redacts quoted free-form secrets in child bindings', () => {
    const output = capture();
    const logger = pino(
      buildPinoOptions({ NODE_ENV: 'production', LOG_LEVEL: 'info' }),
      output.stream,
    );

    logger
      .child({ note: 'password="QUOTED_SECRET"' })
      .info('quoted binding entry');

    const lines = output
      .output()
      .split('\n')
      .filter((line) => line.length);
    expect(lines).toHaveLength(1);
    const record = JSON.parse(lines[0]) as { note?: string };
    expect(JSON.stringify(record)).not.toContain('QUOTED_SECRET');
    expect(record.note).toBe('password=[Redacted]');
  });

  it('keeps JSON valid and redacts quoted free-form secrets in log objects', () => {
    const output = capture();
    const logger = pino(
      buildPinoOptions({ NODE_ENV: 'production', LOG_LEVEL: 'info' }),
      output.stream,
    );

    logger.info({ detail: "token='SINGLE_QUOTED_SECRET'" }, 'quoted entry');

    const lines = output
      .output()
      .split('\n')
      .filter((line) => line.length);
    const record = JSON.parse(lines[0]) as { detail?: string };
    expect(JSON.stringify(record)).not.toContain('SINGLE_QUOTED_SECRET');
    expect(record.detail).toBe('token=[Redacted]');
  });

  it('sanitizes the same object referenced by two fields', () => {
    const output = capture();
    const logger = pino(
      buildPinoOptions({ NODE_ENV: 'production', LOG_LEVEL: 'info' }),
      output.stream,
    );
    const shared = { note: 'password=SHARED_SECRET', token: 'SHARED_TOKEN' };

    logger.info({ first: shared, second: shared }, 'shared references');

    const text = output.output();
    expect(text).not.toContain('SHARED_SECRET');
    expect(text).not.toContain('SHARED_TOKEN');
    expect(text).toContain('password=[Redacted]');
    expect(text).toContain(`"token":"${REDACTION_CENSOR}"`);
  });

  it('sanitizes shared and circular references in the same object graph', () => {
    const shared: Record<string, unknown> = {
      note: 'password=CIRCULAR_SECRET',
    };
    shared.self = shared;

    const redacted = redactValue({
      first: shared,
      second: shared,
    }) as Record<string, unknown>;
    const first = redacted.first as Record<string, unknown>;

    expect(first.note).toBe('password=[Redacted]');
    expect(first.self).toBe(first);
    expect(redacted.second).toBe(first);
    expect(redacted.second).not.toBe(shared);
  });

  describe('HTTP options', () => {
    it('does not serialize request or response objects', () => {
      const options = buildPinoHttpOptions({ NODE_ENV: 'production' });

      expect(options.serializers?.req?.({})).toBeUndefined();
      expect(options.serializers?.res?.({})).toBeUndefined();
    });

    it('logs 4xx at warn and 5xx at error, and stays silent on success', () => {
      const options = buildPinoHttpOptions({ NODE_ENV: 'production' });
      const level = (statusCode: number) =>
        options.customLogLevel?.(requestLike(), responseLike(statusCode));

      expect(level(200)).toBe('silent');
      expect(level(302)).toBe('silent');
      expect(level(400)).toBe('warn');
      expect(level(404)).toBe('warn');
      expect(level(500)).toBe('error');
    });

    it('emits safe http metadata and never request or response bodies', () => {
      const options = buildPinoHttpOptions({ NODE_ENV: 'production' });
      const request = requestLike({
        url: '/users?token=SENTINEL-QUERY',
        route: { path: '/:id' },
        body: { secret: 'SENTINEL-BODY' },
      });

      const success = options.customSuccessObject?.(
        request,
        responseLike(404),
        {},
      );
      const failure = options.customErrorObject?.(
        request,
        responseLike(500),
        new Error('boom'),
        {},
      );
      const serialized = JSON.stringify({ success, failure });

      expect(success).toEqual({
        http: { method: 'POST', route: '/:id', statusCode: 404 },
      });
      expect(failure).toMatchObject({
        http: { method: 'POST', route: '/:id', statusCode: 500 },
        err: expect.any(Error),
      });
      expect(serialized).not.toContain('SENTINEL-BODY');
      expect(serialized).not.toContain('SENTINEL-QUERY');
      expect(serialized).not.toContain('body');
    });

    it('binds requestId and module to request-scoped entries', () => {
      const options = buildPinoHttpOptions({ NODE_ENV: 'production' });
      const props = options.customProps?.(
        requestLike({ id: 'abc-123' }),
        responseLike(200),
      );

      expect(props).toEqual({ requestId: 'abc-123', module: 'users' });
    });
  });
});
