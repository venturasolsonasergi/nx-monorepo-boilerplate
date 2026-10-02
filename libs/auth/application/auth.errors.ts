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
