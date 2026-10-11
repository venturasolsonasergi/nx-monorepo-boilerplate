import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

import { configureDocs, resolveDocsEnabled } from './configure-docs';

@Module({})
class DocsTestModule {}

const ARTIFACT_PATH = join(process.cwd(), 'apps', 'api', 'openapi.json');
let createdArtifact = false;

beforeAll(() => {
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
});

afterAll(() => {
  if (createdArtifact) {
    rmSync(ARTIFACT_PATH, { force: true });
  }
});

async function createDocsApp(
  env: NodeJS.ProcessEnv,
): Promise<INestApplication<App>> {
  const moduleFixture = await Test.createTestingModule({
    imports: [DocsTestModule],
  }).compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  configureDocs(app, env);
  await app.init();
  return app;
}

describe('resolveDocsEnabled', () => {
  it('is enabled by default outside production', () => {
    expect(resolveDocsEnabled({ NODE_ENV: 'development' })).toBe(true);
    expect(resolveDocsEnabled({})).toBe(true);
  });

  it('is disabled by default in production', () => {
    expect(resolveDocsEnabled({ NODE_ENV: 'production' })).toBe(false);
  });

  it('lets the flag override the default in any environment', () => {
    expect(
      resolveDocsEnabled({ NODE_ENV: 'production', API_DOCS_ENABLED: 'true' }),
    ).toBe(true);
    expect(
      resolveDocsEnabled({
        NODE_ENV: 'development',
        API_DOCS_ENABLED: 'false',
      }),
    ).toBe(false);
  });

  it('ignores non-boolean flag values and falls back to the default', () => {
    expect(
      resolveDocsEnabled({ NODE_ENV: 'production', API_DOCS_ENABLED: 'yes' }),
    ).toBe(false);
    expect(
      resolveDocsEnabled({ NODE_ENV: 'development', API_DOCS_ENABLED: '1' }),
    ).toBe(true);
  });
});

describe('configureDocs', () => {
  it('serves the JSON document and the reference UI when enabled', async () => {
    const app = await createDocsApp({ NODE_ENV: 'development' });

    const json = await request(app.getHttpServer())
      .get('/docs/openapi.json')
      .expect(200);
    expect(json.headers['content-type']).toContain('application/json');
    expect(json.body).toMatchObject({ openapi: '3.0.3' });

    const html = await request(app.getHttpServer()).get('/docs').expect(200);
    expect(html.headers['content-type']).toContain('text/html');
    expect(html.text).toContain('/docs/openapi.json');

    await app.close();
  });

  it('does not serve documentation in production by default', async () => {
    const app = await createDocsApp({ NODE_ENV: 'production' });

    await request(app.getHttpServer()).get('/docs').expect(404);
    await request(app.getHttpServer()).get('/docs/openapi.json').expect(404);

    await app.close();
  });

  it('does not serve documentation when explicitly disabled outside production', async () => {
    const app = await createDocsApp({
      NODE_ENV: 'development',
      API_DOCS_ENABLED: 'false',
    });

    await request(app.getHttpServer()).get('/docs').expect(404);
    await request(app.getHttpServer()).get('/docs/openapi.json').expect(404);

    await app.close();
  });

  it('serves documentation in production when explicitly enabled', async () => {
    const app = await createDocsApp({
      NODE_ENV: 'production',
      API_DOCS_ENABLED: 'true',
    });

    await request(app.getHttpServer()).get('/docs').expect(200);
    await request(app.getHttpServer()).get('/docs/openapi.json').expect(200);

    await app.close();
  });
});
