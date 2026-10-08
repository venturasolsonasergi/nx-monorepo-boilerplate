import type { UserSettingsEntity } from '../domain/user-settings.entity';

export class UserSettingsNotFoundError extends Error {
  constructor() {
    super('Settings not found');
    this.name = 'UserSettingsNotFoundError';
  }
}

export interface UserSettingsRepository {
  findByAuthUserId(authUserId: string): Promise<UserSettingsEntity | null>;
  upsert(entity: UserSettingsEntity): Promise<UserSettingsEntity>;
}
