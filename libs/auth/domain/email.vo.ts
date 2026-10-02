const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class EmailValueObject {
  public readonly value: string;

  constructor(value: string) {
    const normalizedValue = typeof value === 'string' ? value.trim() : '';
    if (!normalizedValue || !EMAIL_PATTERN.test(normalizedValue)) {
      throw new Error('Email must be valid');
    }

    this.value = normalizedValue.toLowerCase();
  }
}
