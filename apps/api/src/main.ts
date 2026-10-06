import { NestFactory } from '@nestjs/core';
import { Logger, PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { createModuleLogger } from './platform/observability/module-context';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureApp(app);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  createModuleLogger(PinoLogger.root, 'api', 'bootstrap').info(
    `API listening on port ${port}`,
  );
}
bootstrap().catch((error: unknown) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`Fatal error during API bootstrap: ${message}\n`);
  process.exit(1);
});
