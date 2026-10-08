import {
  SupportedLanguageValueObject,
  type SupportedLanguageCode,
} from './supported-language.vo';

export interface UserSettingsEntityProps {
  id?: number;
  authUserId: string;
  language: SupportedLanguageCode;
}

export class UserSettingsEntity {
  public readonly props: UserSettingsEntityProps;

  constructor(input: { id?: number; authUserId: string; language: string }) {
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

    this.props = {
      id: input.id,
      authUserId,
      language,
    };
  }
}
