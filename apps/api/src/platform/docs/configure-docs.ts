import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import { apiReference } from '@scalar/nestjs-api-reference';
import type { Express, Request, RequestHandler, Response } from 'express';

export interface DocsEnvironment {
  NODE_ENV?: string;
  API_DOCS_ENABLED?: string;
}

const PRODUCTION = 'production';
const DOCS_JSON_ROUTE = '/docs/openapi.json';
const DOCS_UI_ROUTE = '/docs';

const ARTIFACT_CANDIDATES = [
  ['apps', 'api', 'openapi.json'],
  ['dist', 'apps', 'api', 'openapi.json'],
] as const;

/**
 * Explicit `API_DOCS_ENABLED` boolean wins; otherwise documentation is enabled
 * outside production and disabled in production (LOG_LEVEL-style default).
 */
export function resolveDocsEnabled(
  env: DocsEnvironment = process.env,
): boolean {
  const configured = env.API_DOCS_ENABLED?.trim().toLowerCase();
  if (configured === 'true') {
    return true;
  }
  if (configured === 'false') {
    return false;
  }

  const environment = env.NODE_ENV?.trim() || 'development';
  return environment !== PRODUCTION;
}

function resolveArtifactPath(): string | undefined {
  for (const segments of ARTIFACT_CANDIDATES) {
    const candidate = join(process.cwd(), ...segments);
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function serveOpenApiDocument(_request: Request, response: Response): void {
  const artifactPath = resolveArtifactPath();
  if (!artifactPath) {
    response
      .status(404)
      .json({ error: 'Merged OpenAPI document is not available' });
    return;
  }

  response.type('application/json').send(readFileSync(artifactPath, 'utf8'));
}

/**
 * Registers the documentation endpoints on the host's Express instance. The
 * JSON handler is registered before the Scalar mount so it wins under `/docs`;
 * both are scoped to the `platform` namespace and carry no DI.
 */
export function configureDocs(
  app: INestApplication,
  env: DocsEnvironment = process.env,
): void {
  if (!resolveDocsEnabled(env)) {
    return;
  }

  const server = app.getHttpAdapter().getInstance() as Express;

  server.get(DOCS_JSON_ROUTE, serveOpenApiDocument);
  server.use(
    DOCS_UI_ROUTE,
    apiReference({ url: DOCS_JSON_ROUTE }) as RequestHandler,
  );
}
