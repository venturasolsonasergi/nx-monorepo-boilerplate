import { ApiError } from '../../../shared/lib/api-client';

// Translation keys under the `common` namespace. Inline, recoverable messages per
// auth failure. A network or service failure is never presented as invalid
// credentials, a duplicate account, or an invalid link.

export function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'authErrors.loginInvalidCredentials';
  }
  if (error instanceof ApiError && error.status === 429) {
    return 'authErrors.loginThrottled';
  }
  if (error instanceof ApiError) {
    return 'authErrors.loginFailed';
  }
  return 'authErrors.network';
}

export function signupErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) {
    return 'authErrors.signupExists';
  }
  if (error instanceof ApiError && error.status === 429) {
    return 'authErrors.signupThrottled';
  }
  if (error instanceof ApiError) {
    return 'authErrors.signupFailed';
  }
  return 'authErrors.network';
}

// Resend always reports request acceptance; only network/service failures are
// surfaced, and they reveal nothing about the address.
export function resendErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) {
    return 'authErrors.resendThrottled';
  }
  if (error instanceof ApiError) {
    return 'authErrors.resendFailed';
  }
  return 'authErrors.network';
}

export function completeSignupErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 400) {
    return 'authErrors.completeInvalid';
  }
  if (error instanceof ApiError && error.status === 409) {
    return 'authErrors.completeConflict';
  }
  if (error instanceof ApiError && error.status === 429) {
    return 'authErrors.completeThrottled';
  }
  if (error instanceof ApiError) {
    return 'authErrors.completeFailed';
  }
  return 'authErrors.network';
}

export function recoverErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return 'authErrors.recoverFailed';
  }
  return 'authErrors.network';
}

export function resetErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 400) {
    return 'authErrors.resetInvalid';
  }
  if (error instanceof ApiError) {
    return 'authErrors.resetFailed';
  }
  return 'authErrors.network';
}
