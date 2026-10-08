import type { UserSettingsRepository } from './user-settings.repository';
import { UserSettingsNotFoundError } from './user-settings.repository';
import type { SupportedLanguageCode } from '../domain/supported-language.vo';

export interface UserSettingsOutput {
  language: SupportedLanguageCode;
}

export class GetUserSettingsUseCase {
  constructor(private readonly repository: UserSettingsRepository) {}

  async execute(authUserId: string): Promise<UserSettingsOutput> {
    const settings = await this.repository.findByAuthUserId(authUserId);

    if (!settings) {
      throw new UserSettingsNotFoundError();
    }

    return { language: settings.props.language };
  }
}
