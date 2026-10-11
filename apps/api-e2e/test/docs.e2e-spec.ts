import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '@app/api/app.module';
import { configureApp } from '@app/api/configure-app';

const WEB_ORIGIN = 'http://localhost:4200';
const ARTIFACT_PATH = join(process.cwd(), 'apps', 'api', 'openapi.json');
let createdArtifact = false;

const PROFILE = {
  name: 'Ada',
  surname: 'Lovelace',
  address: '1 Main Street',
  phone: '555-0100',
};

async function createApp(
  env: NodeJS.ProcessEnv,
): Promise<INestApplication<App>> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  configureApp(app, env);
  await app.init();
  return app;
}

describe('API documentation (e2e)', () => {
  let enabled: INestApplication<App>;
  let disabled: INestApplication<App>;

  beforeAll(async () => {
    if (!existsSync(ARTIFACT_PATH)) {
      mkdirSync(dirname(ARTIFACT_PATH), { recursive: true });
      writeFileSync(
        ARTIFACT_PATH,
        JSON.stringify({
          openapi: '3.0.3',
          info: { title: 'Test', version: '1.0.0' },
          servers: [{ url: '/' }],
          paths: {},
        }),
      );
      createdArtifact = true;
    }

    enabled = await createApp({
      ...process.env,
      NODE_ENV: 'development',
      API_DOCS_ENABLED: '',
    });
    disabled = await createApp({
      ...process.env,
      NODE_ENV: 'production',
      API_DOCS_ENABLED: '',
    });
  });

  afterAll(async () => {
    if (disabled) {
      await disabled.close();
    }
    if (enabled) {
      await enabled.close();
    }
    if (createdArtifact) {
      rmSync(ARTIFACT_PATH, { force: true });
    }
  });

  describe('when enabled', () => {
    it('serves the merged JSON document with paths from all hosted services', async () => {
      const response = await request(enabled.getHttpServer())
        .get('/docs/openapi.json')
        .expect(200);

      expect(response.headers['content-type']).toContain('application/json');
      const body = response.body as {
        openapi: string;
        paths: Record<string, unknown>;
      };
      expect(body.openapi).toBe('3.0.3');
      expect(Object.keys(body.paths)).toEqual(
        expect.arrayContaining([
          '/auth/login',
          '/users/health',
          '/orders/health',
        ]),
      );
    });

    it('serves the reference UI at /docs', async () => {
      const response = await request(enabled.getHttpServer())
        .get('/docs')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('/docs/openapi.json');
    });

    it('leaves the orders health check identical to when documentation is disabled', async () => {
      const withDocs = await request(enabled.getHttpServer())
        .get('/orders/health')
        .expect(200);
      const withoutDocs = await request(disabled.getHttpServer())
        .get('/orders/health')
        .expect(200);

      expect(withDocs.body).toEqual({ status: 'ok' });
      expect(withDocs.body).toEqual(withoutDocs.body);
      expect(withDocs.status).toBe(withoutDocs.status);
    });

    it('leaves auth and users middleware behavior untouched', async () => {
      await request(enabled.getHttpServer())
        .post('/users')
        .set('Origin', 'http://evil.example.com')
        .send(PROFILE)
        .expect(403);

      await request(enabled.getHttpServer())
        .post('/users')
        .set('Origin', WEB_ORIGIN)
        .send(PROFILE)
        .expect(401);

      await request(enabled.getHttpServer())
        .post('/users')
        .send(PROFILE)
        .expect(403);

      await request(enabled.getHttpServer())
        .post('/auth/login')
        .send({ email: 'a@b.c', password: 'x' })
        .expect(403);
    });
  });

  describe('when disabled in production', () => {
    it('does not serve either documentation endpoint', async () => {
      await request(disabled.getHttpServer()).get('/docs').expect(404);
      await request(disabled.getHttpServer())
        .get('/docs/openapi.json')
        .expect(404);
    });
  });
});
