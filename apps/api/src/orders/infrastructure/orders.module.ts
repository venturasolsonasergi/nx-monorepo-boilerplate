import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersPrismaRepository } from './orders.repository.prisma';
import { CreateOrderUseCase } from '../application/create-order.use-case';

@Module({
  controllers: [OrdersController],
  providers: [
    OrdersPrismaRepository,
    {
      provide: CreateOrderUseCase,
      useFactory: (repository: OrdersPrismaRepository) =>
        new CreateOrderUseCase(repository),
      inject: [OrdersPrismaRepository],
    },
  ],
})
export class OrdersModule {}
