import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { authApi } from '../api/auth.api';
import { resetErrorMessage } from '../lib/auth-messages';

// Landed here from the emailed reset link (GET /auth/reset-password/confirm),
// which redirects with the token in the query string.
export default function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'submitting' | 'done' | 'error'
  >('idle');
  const [error, setError] = useState<unknown>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('submitting');
    setError(null);

    try {
      await authApi.confirmPasswordReset({ token, password });
      setStatus('done');
    } catch (caught) {
      setError(caught);
      setStatus('error');
    }
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-md p-6 text-sm text-red-600">
        Falta el token de restablecimiento.
      </main>
    );
  }

  if (status === 'done') {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <p className="text-sm text-green-700">
          Contraseña actualizada. Ya puedes iniciar sesión.
        </p>
        <Link to="/login" className="text-sm underline">
          Iniciar sesión
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-lg font-semibold">Restablecer contraseña</h1>
      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        className="flex flex-col gap-3"
      >
        <label htmlFor="reset-password" className="text-sm font-medium">
          Nueva contraseña
        </label>
        <Input
          id="reset-password"
          type="password"
          placeholder="Nueva contraseña"
          autoComplete="new-password"
          value={password}
          minLength={8}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setPassword(event.target.value)
          }
          required
        />
        <Button type="submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Guardando…' : 'Cambiar contraseña'}
        </Button>
      </form>
      {status === 'error' ? (
        <p role="alert" className="text-sm text-red-600">
          {resetErrorMessage(error)}
        </p>
      ) : null}
    </main>
  );
}
