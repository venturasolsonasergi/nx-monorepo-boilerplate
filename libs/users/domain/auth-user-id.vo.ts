export class AuthUserIdValueObject {
  public readonly value: string;

  constructor(value: string) {
    const normalizedValue = typeof value === 'string' ? value.trim() : '';
    if (!normalizedValue) {
      throw new Error('AuthUserId must be a non-empty string');
    }

    this.value = normalizedValue;
  }
}
