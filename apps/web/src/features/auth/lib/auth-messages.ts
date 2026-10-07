import { ApiError } from '../../../shared/lib/api-client';

// Inline, recoverable messages per auth failure. A network or service failure is
// never presented as invalid credentials, a duplicate account, or an invalid link.

export function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'Correo o contraseña no válidos.';
  }
  if (error instanceof ApiError && error.status === 429) {
    return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
  }
  if (error instanceof ApiError) {
    return 'No se pudo iniciar sesión. Revisa los datos e inténtalo de nuevo.';
  }
  return 'No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.';
}

export function signupErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) {
    return 'Este correo ya está registrado.';
  }
  if (error instanceof ApiError && error.status === 429) {
    return 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.';
  }
  if (error instanceof ApiError) {
    return 'No se pudo iniciar el registro. Revisa el correo e inténtalo de nuevo.';
  }
  return 'No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.';
}

// Resend always reports request acceptance; only network/service failures are
// surfaced, and they reveal nothing about the address.
export function resendErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) {
    return 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.';
  }
  if (error instanceof ApiError) {
    return 'No se pudo solicitar el reenvío. Inténtalo de nuevo.';
  }
  return 'No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.';
}

export function completeSignupErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 400) {
    return 'El enlace no es válido o ha caducado. Inicia el registro de nuevo.';
  }
  if (error instanceof ApiError && error.status === 409) {
    return 'No se pudo completar el registro con este correo.';
  }
  if (error instanceof ApiError && error.status === 429) {
    return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
  }
  if (error instanceof ApiError) {
    return 'No se pudo completar el registro. Inténtalo de nuevo.';
  }
  return 'No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.';
}

export function recoverErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return 'No se pudo enviar la solicitud. Revisa el correo e inténtalo de nuevo.';
  }
  return 'No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.';
}

export function resetErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 400) {
    return 'El enlace no es válido o ha caducado.';
  }
  if (error instanceof ApiError) {
    return 'No se pudo restablecer la contraseña. Inténtalo de nuevo.';
  }
  return 'No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.';
}
