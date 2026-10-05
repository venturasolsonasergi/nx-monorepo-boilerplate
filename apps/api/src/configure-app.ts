import type { INestApplication } from '@nestjs/common';

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

export const EXPOSED_RESPONSE_HEADERS = ['x-request-id'];

export function configureApp(app: INestApplication): void {
  app.enableCors({
    origin: collectTrustedOrigins(),
    credentials: true,
    exposedHeaders: EXPOSED_RESPONSE_HEADERS,
  });
}
