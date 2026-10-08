import type { UserSettingsRepository } from './user-settings.repository';
import { UserSettingsEntity } from '../domain/user-settings.entity';
import { AuthUserIdValueObject } from '../domain/auth-user-id.vo';
import type { UserSettingsOutput } from './get-user-settings.use-case';

export interface UpdateUserSettingsInput {
  authUserId: string;
  language: string;
}

export class UpdateUserSettingsUseCase {
  constructor(private readonly repository: UserSettingsRepository) {}

  async execute(input: UpdateUserSettingsInput): Promise<UserSettingsOutput> {
    const authUserId = new AuthUserIdValueObject(input.authUserId).value;
    const settings = new UserSettingsEntity({
      authUserId,
      language: input.language,
    });
    const persisted = await this.repository.upsert(settings);

    return { language: persisted.props.language };
  }
}
