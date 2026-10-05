import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersPrismaRepository } from './users.repository.prisma';
import { CreateProfileUseCase } from '../application/create-profile.use-case';
import { GetCurrentProfileUseCase } from '../application/get-current-profile.use-case';
import { PrismaService } from './prisma/prisma.service';

@Module({
  controllers: [UsersController],
  providers: [
    PrismaService,
    UsersPrismaRepository,
    {
      provide: CreateProfileUseCase,
      useFactory: (repository: UsersPrismaRepository) =>
        new CreateProfileUseCase(repository),
      inject: [UsersPrismaRepository],
    },
    {
      provide: GetCurrentProfileUseCase,
      useFactory: (repository: UsersPrismaRepository) =>
        new GetCurrentProfileUseCase(repository),
      inject: [UsersPrismaRepository],
    },
  ],
})
export class UsersModule {}
