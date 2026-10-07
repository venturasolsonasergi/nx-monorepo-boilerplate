import { createHash, randomBytes } from 'node:crypto';

const TOKEN_BYTES = 32;

export class RegistrationToken {
  private constructor(public readonly value: string) {}

  static generate(): RegistrationToken {
    return new RegistrationToken(
      randomBytes(TOKEN_BYTES).toString('base64url'),
    );
  }

  static fromValue(value: string): RegistrationToken {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error('Registration token must be a non-empty string');
    }

    return new RegistrationToken(value);
  }

  static hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  get hash(): string {
    return RegistrationToken.hash(this.value);
  }
}
