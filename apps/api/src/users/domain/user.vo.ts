export class UserEmailValueObject {
  public readonly value: string;

  constructor(value: string) {
    const normalizedValue = value.trim();
    if (
      !normalizedValue ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedValue)
    ) {
      throw new Error('User email must be valid');
    }

    this.value = normalizedValue;
  }
}
