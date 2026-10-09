import { Inject, Injectable } from '@nestjs/common';
import { UserSettingsEntity } from '../domain/user-settings.entity';
import type { UserSettingsRepository } from '../application/user-settings.repository';
import { PrismaService } from './prisma/prisma.service';

interface UserSettingsRow {
  id: number;
  auth_user_id: string;
  language: string;
  theme: string;
}

function toUserSettingsEntity(row: UserSettingsRow): UserSettingsEntity {
  return new UserSettingsEntity({
    id: row.id,
    authUserId: row.auth_user_id,
    language: row.language,
    theme: row.theme,
  });
}

@Injectable()
export class UserSettingsPrismaRepository implements UserSettingsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findByAuthUserId(
    authUserId: string,
  ): Promise<UserSettingsEntity | null> {
    const record = await this.prisma.userSettings.findUnique({
      where: { auth_user_id: authUserId },
    });

    return record ? toUserSettingsEntity(record) : null;
  }

  async upsert(entity: UserSettingsEntity): Promise<UserSettingsEntity> {
    const record = await this.prisma.userSettings.upsert({
      where: { auth_user_id: entity.props.authUserId },
      update: {
        language: entity.props.language,
        theme: entity.props.theme,
      },
      create: {
        auth_user_id: entity.props.authUserId,
        language: entity.props.language,
        theme: entity.props.theme,
      },
    });

    return toUserSettingsEntity(record);
  }
}
