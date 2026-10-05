import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, HttpAdapterHost } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from '@app/auth/infrastructure/auth.module';
import { OriginValidationMiddleware } from '@app/auth/infrastructure/origin-validation.middleware';
import { SessionValidationMiddleware } from '@app/auth/infrastructure/session-validation.middleware';
import { UsersModule } from '@app/users/infrastructure/users.module';
import { OrdersModule } from '@app/orders/infrastructure/orders.module';
import { createLoggerParams } from './platform/observability/logging.config';
import { OperationalExceptionFilter } from './platform/observability/operational-exception.filter';

@Module({
  imports: [
    LoggerModule.forRoot(createLoggerParams()),
    AuthModule,
    UsersModule,
    OrdersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useFactory: (adapterHost: HttpAdapterHost) =>
        new OperationalExceptionFilter(adapterHost),
      inject: [HttpAdapterHost],
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(OriginValidationMiddleware).forRoutes('auth', 'users');

    consumer
      .apply(SessionValidationMiddleware)
      .exclude('users/health')
      .forRoutes('users');
  }
}
