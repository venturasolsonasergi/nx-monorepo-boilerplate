export const MIN_PASSWORD_LENGTH = 8;

export class PasswordValueObject {
  public readonly value: string;

  constructor(value: string) {
    if (typeof value !== 'string' || value.length < MIN_PASSWORD_LENGTH) {
      throw new Error(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
      );
    }

    this.value = value;
  }
}
