import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from '@app/auth/infrastructure/auth.module';
import { OriginValidationMiddleware } from '@app/auth/infrastructure/origin-validation.middleware';
import { SessionValidationMiddleware } from '@app/auth/infrastructure/session-validation.middleware';
import { UsersModule } from '@app/users/infrastructure/users.module';
import { OrdersModule } from '@app/orders/infrastructure/orders.module';

@Module({
  imports: [AuthModule, UsersModule, OrdersModule],
  controllers: [AppController],
  providers: [AppService],
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
