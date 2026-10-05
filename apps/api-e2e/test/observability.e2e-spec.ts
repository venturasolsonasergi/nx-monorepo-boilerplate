import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PARAMS_PROVIDER_TOKEN } from 'nestjs-pino';
import { AppModule } from '@app/api/app.module';
import { configureApp } from '@app/api/configure-app';
import { createLoggerParams } from '@app/api/platform/observability/logging.config';

const WEB_ORIGIN = 'http://localhost:4200';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_PROFILE = {
  name: 'Ada',
  surname: 'Lovelace',
  address: '1 Main Street',
  phone: '555-0100',
};

@Controller('__observability')
class FailingController {
  @Get('boom')
  boom(): never {
    throw new Error('unexpected failure');
  }
}

interface LogRecord {
  level: number;
  msg?: string;
  requestId?: string;
  module?: string;
  http?: {
    method?: string;
    route?: string;
    statusCode?: number;
  };
  err?: {
    type?: string;
    message?: string;
    stack?: string;
  };
}

interface Capture {
  stream: { write(chunk: string): void };
  records: () => LogRecord[];
  clear: () => void;
}

function createCapture(): Capture {
  let chunks: string[] = [];
  return {
    stream: {
      write(chunk: string): void {
        chunks.push(chunk);
      },
    },
    records: () =>
      chunks
        .join('')
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as LogRecord),
    clear: () => {
      chunks = [];
    },
  };
}

describe('Operational logging (e2e)', () => {
  let app: INestApplication<App>;
  let capture: Capture;

  beforeAll(async () => {
    capture = createCapture();
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [FailingController],
    })
      .overrideProvider(PARAMS_PROVIDER_TOKEN)
      .useValue(
        createLoggerParams(
          { NODE_ENV: 'production', LOG_LEVEL: 'info' },
          capture.stream,
        ),
      )
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    capture.clear();
  });

  function triggerUsersFailure(headers: Record<string, string> = {}) {
    let chain = request(app.getHttpServer())
      .post('/users')
      .set('Origin', WEB_ORIGIN);
    for (const [name, value] of Object.entries(headers)) {
      chain = chain.set(name, value);
    }
    return chain.send(VALID_PROFILE);
  }

  describe('request correlation', () => {
    it('reuses a valid inbound identifier on the response and log entry', async () => {
      const response = await triggerUsersFailure({
        'x-request-id': 'client-id.42',
      }).expect(401);

      expect(response.headers['x-request-id']).toBe('client-id.42');

      const [record] = capture.records();
      expect(record).toMatchObject({
        requestId: 'client-id.42',
        module: 'users',
      });
    });

    it('generates an identifier when the header is missing', async () => {
      const response = await triggerUsersFailure().expect(401);
      const header = response.headers['x-request-id'];

      expect(header).toMatch(UUID_PATTERN);
      expect(capture.records()[0].requestId).toBe(header);
    });

    it('replaces a repeated identifier', async () => {
      // Node joins duplicate request headers into a single comma-separated
      // value, which must not be reused as a correlation identifier.
      const response = await triggerUsersFailure({
        'x-request-id': 'first, second',
      }).expect(401);
      const header = response.headers['x-request-id'];

      expect(header).toMatch(UUID_PATTERN);
      expect(header).not.toBe('first, second');
      expect(capture.records()[0].requestId).toBe(header);
    });

    it('replaces a malformed identifier', async () => {
      const response = await triggerUsersFailure({
        'x-request-id': 'not a valid id',
      }).expect(401);
      const header = response.headers['x-request-id'];

      expect(header).toMatch(UUID_PATTERN);
      expect(capture.records()[0].requestId).toBe(header);
    });

    it('replaces an oversized identifier', async () => {
      const response = await triggerUsersFailure({
        'x-request-id': 'a'.repeat(129),
      }).expect(401);
      const header = response.headers['x-request-id'];

      expect(header).toMatch(UUID_PATTERN);
      expect(capture.records()[0].requestId).toBe(header);
    });

    it('reuses an identifier of exactly 128 characters', async () => {
      const value = 'a'.repeat(128);
      const response = await triggerUsersFailure({
        'x-request-id': value,
      }).expect(401);

      expect(response.headers['x-request-id']).toBe(value);
      expect(capture.records()[0].requestId).toBe(value);
    });

    it('exposes the correlation header to trusted browser origins', async () => {
      const response = await triggerUsersFailure().expect(401);

      expect(
        String(response.headers['access-control-expose-headers']),
      ).toContain('x-request-id');
    });
  });

  describe('failure records', () => {
    it('emits exactly one warn record for a 4xx response', async () => {
      await triggerUsersFailure({ 'x-request-id': 'warn-4xx' }).expect(401);

      const records = capture.records();
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        level: 40,
        msg: 'http request failed',
        requestId: 'warn-4xx',
        module: 'users',
        http: {
          method: 'POST',
          route: '/users',
          statusCode: 401,
        },
      });
      expect(records[0].err).toBeUndefined();
    });

    it('serializes an unexpected exception as one error record and keeps serving', async () => {
      await request(app.getHttpServer())
        .get('/__observability/boom')
        .set('x-request-id', 'error-5xx')
        .expect(500)
        .expect({ statusCode: 500, message: 'Internal server error' });

      const records = capture.records();
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        level: 50,
        requestId: 'error-5xx',
        module: 'api',
        http: {
          method: 'GET',
          route: '/__observability/boom',
          statusCode: 500,
        },
      });
      expect(records[0].err).toMatchObject({
        type: 'Error',
        message: 'unexpected failure',
      });
      expect(records[0].err?.stack).toContain('unexpected failure');

      await request(app.getHttpServer()).get('/').expect(200);
    });

    it('keeps the owning module and base route on middleware rejections', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('Origin', 'http://evil.example.com')
        .send({ email: 'a@b.c', password: 'x' })
        .expect(403);

      await request(app.getHttpServer())
        .post('/users')
        .send(VALID_PROFILE)
        .expect(403);

      const records = capture.records();
      expect(records[0]).toMatchObject({
        module: 'auth',
        http: { method: 'POST', route: '/auth', statusCode: 403 },
      });
      expect(records[1]).toMatchObject({
        module: 'users',
        http: { method: 'POST', route: '/users', statusCode: 403 },
      });
    });

    it('does not log request or response bodies on failure', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .set('Origin', WEB_ORIGIN)
        .send({ ...VALID_PROFILE, name: 'SENTINEL-BODY-NAME' })
        .expect(401);

      const serialized = JSON.stringify(capture.records());
      expect(serialized).not.toContain('SENTINEL-BODY-NAME');
      expect(serialized).not.toContain('Lovelace');
    });
  });
});
