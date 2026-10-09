import {
  SupportedLanguageValueObject,
  type SupportedLanguageCode,
} from './supported-language.vo';
import {
  SupportedThemeValueObject,
  type SupportedThemeCode,
} from './supported-theme.vo';

export interface UserSettingsEntityProps {
  id?: number;
  authUserId: string;
  language: SupportedLanguageCode;
  theme: SupportedThemeCode;
}

export class UserSettingsEntity {
  public readonly props: UserSettingsEntityProps;

  constructor(input: {
    id?: number;
    authUserId: string;
    language: string;
    theme: string;
  }) {
    const authUserId =
      typeof input.authUserId === 'string' ? input.authUserId.trim() : '';

    if (!authUserId) {
      throw new Error('AuthUserId must be a non-empty string');
    }

    if (
      input.id !== undefined &&
      (!Number.isInteger(input.id) || input.id <= 0)
    ) {
      throw new Error('UserSettings id must be a positive integer');
    }

    const language = new SupportedLanguageValueObject(input.language).value;
    const theme = new SupportedThemeValueObject(input.theme).value;

    this.props = {
      id: input.id,
      authUserId,
      language,
      theme,
    };
  }
}
