import type { INestApplication } from '@nestjs/common';
import { configureDocs } from './platform/docs/configure-docs';

export function collectTrustedOrigins(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const values = [
    env.AUTH_WEB_URL,
    env.AUTH_BASE_URL,
    ...(env.AUTH_TRUSTED_ORIGINS ?? '').split(','),
  ];

  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

export const EXPOSED_RESPONSE_HEADERS = ['x-request-id', 'Retry-After'];

export function configureApp(
  app: INestApplication,
  env: NodeJS.ProcessEnv = process.env,
): void {
  app.enableCors({
    origin: collectTrustedOrigins(env),
    credentials: true,
    exposedHeaders: EXPOSED_RESPONSE_HEADERS,
  });

  configureDocs(app, env);
}
