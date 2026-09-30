import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersPrismaRepository } from './users.repository.prisma';
import { CreateUserUseCase } from '../application/create-user.use-case';
import { PrismaService } from './prisma/prisma.service';

@Module({
  controllers: [UsersController],
  providers: [
    PrismaService,
    UsersPrismaRepository,
    {
      provide: CreateUserUseCase,
      useFactory: (repository: UsersPrismaRepository) =>
        new CreateUserUseCase(repository),
      inject: [UsersPrismaRepository],
    },
  ],
})
export class UsersModule {}
