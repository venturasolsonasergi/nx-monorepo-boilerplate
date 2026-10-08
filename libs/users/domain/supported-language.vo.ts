export const SUPPORTED_LANGUAGES = ['es', 'en', 'ca'] as const;

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number];

export function isSupportedLanguage(
  value: string,
): value is SupportedLanguageCode {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export class SupportedLanguageValueObject {
  public readonly value: SupportedLanguageCode;

  constructor(value: string) {
    const normalizedValue = typeof value === 'string' ? value.trim() : '';

    if (!isSupportedLanguage(normalizedValue)) {
      throw new Error(`Unsupported language: ${value}`);
    }

    this.value = normalizedValue;
  }
}
