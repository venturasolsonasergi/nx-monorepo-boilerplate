import type { UserSettingsRepository } from './user-settings.repository';
import { UserSettingsEntity } from '../domain/user-settings.entity';
import { AuthUserIdValueObject } from '../domain/auth-user-id.vo';
import type { UserSettingsOutput } from './get-user-settings.use-case';

export interface UpdateUserSettingsInput {
  authUserId: string;
  language: string;
  theme?: string;
}

const DEFAULT_THEME = 'system';

export class UpdateUserSettingsUseCase {
  constructor(private readonly repository: UserSettingsRepository) {}

  async execute(input: UpdateUserSettingsInput): Promise<UserSettingsOutput> {
    const authUserId = new AuthUserIdValueObject(input.authUserId).value;
    const existing = await this.repository.findByAuthUserId(authUserId);
    const settings = new UserSettingsEntity({
      id: existing?.props.id,
      authUserId,
      language: input.language,
      theme: input.theme ?? existing?.props.theme ?? DEFAULT_THEME,
    });
    const persisted = await this.repository.upsert(settings);

    return {
      language: persisted.props.language,
      theme: persisted.props.theme,
    };
  }
}
