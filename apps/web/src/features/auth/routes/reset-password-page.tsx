import { useState, type FormEvent } from 'react';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { authApi } from '../api/auth.api';

// Landed here from the emailed reset link (GET /auth/reset-password/confirm),
// which redirects with the token in the query string.
export default function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'submitting' | 'done' | 'error'
  >('idle');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('submitting');

    try {
      await authApi.confirmPasswordReset({ token, password });
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md p-6 text-sm text-red-600">
        Falta el token de restablecimiento.
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className="mx-auto max-w-md p-6 text-sm text-green-700">
        Contraseña actualizada. Ya puedes iniciar sesión.
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className="mx-auto flex max-w-md flex-col gap-3 p-6"
    >
      <h1 className="text-lg font-semibold">Restablecer contraseña</h1>
      <Input
        type="password"
        placeholder="Nueva contraseña"
        value={password}
        minLength={8}
        onChange={(event) => setPassword(event.target.value)}
        required
      />
      <Button type="submit" disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Guardando…' : 'Cambiar contraseña'}
      </Button>
      {status === 'error' ? (
        <p className="text-sm text-red-600">
          El enlace no es válido o ha caducado.
        </p>
      ) : null}
    </form>
  );
}
