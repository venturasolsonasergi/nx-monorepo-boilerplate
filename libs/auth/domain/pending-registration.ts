export const REGISTRATION_TTL_SECONDS = 48 * 60 * 60;

export interface PendingRegistrationProps {
  id: string;
  email: string;
  createdAt: Date;
  expiresAt: Date;
  tokenHash: string | null;
  consumedAt: Date | null;
}

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

export class PendingRegistration {
  constructor(public readonly props: PendingRegistrationProps) {
    if (typeof props.id !== 'string' || props.id.trim().length === 0) {
      throw new Error('Pending registration id must be a non-empty string');
    }

    if (typeof props.email !== 'string' || props.email.trim().length === 0) {
      throw new Error('Pending registration email must be a non-empty string');
    }
  }

  static initiate(input: {
    id: string;
    email: string;
    initiatedAt: Date;
  }): PendingRegistration {
    return new PendingRegistration({
      id: input.id,
      email: input.email.trim().toLowerCase(),
      createdAt: input.initiatedAt,
      expiresAt: addSeconds(input.initiatedAt, REGISTRATION_TTL_SECONDS),
      tokenHash: null,
      consumedAt: null,
    });
  }

  get id(): string {
    return this.props.id;
  }

  get email(): string {
    return this.props.email;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get tokenHash(): string | null {
    return this.props.tokenHash;
  }

  get consumedAt(): Date | null {
    return this.props.consumedAt;
  }

  isExpired(now: Date): boolean {
    return now.getTime() >= this.props.expiresAt.getTime();
  }

  isConsumed(): boolean {
    return this.props.consumedAt !== null;
  }

  isActive(now: Date): boolean {
    return !this.isConsumed() && !this.isExpired(now);
  }

  withTokenHash(tokenHash: string): PendingRegistration {
    return new PendingRegistration({ ...this.props, tokenHash });
  }

  withConsumedAt(consumedAt: Date): PendingRegistration {
    return new PendingRegistration({ ...this.props, consumedAt });
  }

  acceptsToken(tokenHash: string, now: Date): boolean {
    return (
      this.isActive(now) &&
      this.props.tokenHash !== null &&
      this.props.tokenHash === tokenHash
    );
  }
}
