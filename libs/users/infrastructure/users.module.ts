import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersPrismaRepository } from './users.repository.prisma';
import { UserSettingsPrismaRepository } from './user-settings.repository.prisma';
import { CreateProfileUseCase } from '../application/create-profile.use-case';
import { GetCurrentProfileUseCase } from '../application/get-current-profile.use-case';
import { GetUserSettingsUseCase } from '../application/get-user-settings.use-case';
import { UpdateUserSettingsUseCase } from '../application/update-user-settings.use-case';
import { PrismaService } from './prisma/prisma.service';

@Module({
  controllers: [UsersController],
  providers: [
    PrismaService,
    UsersPrismaRepository,
    UserSettingsPrismaRepository,
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
    {
      provide: GetUserSettingsUseCase,
      useFactory: (repository: UserSettingsPrismaRepository) =>
        new GetUserSettingsUseCase(repository),
      inject: [UserSettingsPrismaRepository],
    },
    {
      provide: UpdateUserSettingsUseCase,
      useFactory: (repository: UserSettingsPrismaRepository) =>
        new UpdateUserSettingsUseCase(repository),
      inject: [UserSettingsPrismaRepository],
    },
  ],
})
export class UsersModule {}
