import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { recoverErrorMessage } from '../lib/auth-messages';
import { useRequestPasswordReset } from '../hooks/use-request-password-reset';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const request = useRequestPasswordReset();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    request.mutate(email);
  }

  if (request.isSuccess) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h1 className="text-lg font-semibold">Revisa tu correo</h1>
        <p className="text-sm text-muted-foreground">
          Si el correo corresponde a una cuenta, recibirás un enlace para
          restablecer tu contraseña.
        </p>
        <Link to="/login" className="text-sm underline">
          Volver a iniciar sesión
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-lg font-semibold">Recuperar contraseña</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="forgot-email" className="text-sm font-medium">
          Correo electrónico
        </label>
        <Input
          id="forgot-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setEmail(event.target.value)
          }
          required
        />
        <Button type="submit" disabled={request.isPending}>
          {request.isPending ? 'Enviando…' : 'Enviar enlace'}
        </Button>
      </form>
      {request.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {recoverErrorMessage(request.error)}
        </p>
      ) : null}
      <Link to="/login" className="text-sm underline">
        Volver a iniciar sesión
      </Link>
    </main>
  );
}
