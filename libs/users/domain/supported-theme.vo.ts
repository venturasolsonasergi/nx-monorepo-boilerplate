export const SUPPORTED_THEMES = ['light', 'dark', 'system'] as const;

export type SupportedThemeCode = (typeof SUPPORTED_THEMES)[number];

export function isSupportedTheme(value: string): value is SupportedThemeCode {
  return (SUPPORTED_THEMES as readonly string[]).includes(value);
}

export class SupportedThemeValueObject {
  public readonly value: SupportedThemeCode;

  constructor(value: string) {
    const normalizedValue = typeof value === 'string' ? value.trim() : '';

    if (!isSupportedTheme(normalizedValue)) {
      throw new Error(`Unsupported theme: ${value}`);
    }

    this.value = normalizedValue;
  }
}
