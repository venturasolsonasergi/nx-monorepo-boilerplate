export class EmailAlreadyExistsError extends Error {
  constructor() {
    super('Email already exists');
    this.name = 'EmailAlreadyExistsError';
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid credentials');
    this.name = 'InvalidCredentialsError';
  }
}

export class UnverifiedEmailError extends Error {
  constructor() {
    super('Email not verified');
    this.name = 'UnverifiedEmailError';
  }
}

export class InvalidSessionError extends Error {
  constructor() {
    super('Invalid session');
    this.name = 'InvalidSessionError';
  }
}

export class InvalidVerificationTokenError extends Error {
  constructor() {
    super('Invalid verification token');
    this.name = 'InvalidVerificationTokenError';
  }
}

export class InvalidResetTokenError extends Error {
  constructor() {
    super('Invalid reset token');
    this.name = 'InvalidResetTokenError';
  }
}

export class UnsupportedProviderError extends Error {
  constructor(provider: string) {
    super(`Unsupported provider: ${provider}`);
    this.name = 'UnsupportedProviderError';
  }
}

export class UntrustedRedirectError extends Error {
  constructor() {
    super('Untrusted redirect');
    this.name = 'UntrustedRedirectError';
  }
}

export class AuthProviderError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AuthProviderError';
  }
}

export class RateLimitedError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super('Too many requests');
    this.name = 'RateLimitedError';
  }
}

export class SourceBlockedError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super('Source is rate limited');
    this.name = 'SourceBlockedError';
  }
}

export class RegistrationConflictError extends Error {
  constructor() {
    super('Registration conflict');
    this.name = 'RegistrationConflictError';
  }
}

export class InvalidPasswordError extends Error {
  constructor(message = 'Password does not meet the policy') {
    super(message);
    this.name = 'InvalidPasswordError';
  }
}

export class ActivationCommittedError extends Error {
  constructor(
    public readonly sessionError: RateLimitedError | AuthProviderError,
  ) {
    super('Activation committed but session issuance failed');
    this.name = 'ActivationCommittedError';
  }
}
