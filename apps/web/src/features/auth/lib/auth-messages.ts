import { ApiError } from '../../../shared/lib/api-client';

// Inline, recoverable messages per auth failure. A network failure is never
// presented as invalid credentials or an invalid link.

export function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'Correo o contraseña no válidos.';
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
  if (error instanceof ApiError) {
    return 'No se pudo crear la cuenta. Revisa los datos e inténtalo de nuevo.';
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
