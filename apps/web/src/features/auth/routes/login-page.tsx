import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { loginErrorMessage } from '../lib/auth-messages';
import { useLogin } from '../hooks/use-login';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    login.mutate({ email, password });
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-lg font-semibold">Iniciar sesión</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="login-email" className="text-sm font-medium">
          Correo electrónico
        </label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setEmail(event.target.value)
          }
          required
        />
        <label htmlFor="login-password" className="text-sm font-medium">
          Contraseña
        </label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setPassword(event.target.value)
          }
          required
        />
        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? 'Accediendo…' : 'Acceder'}
        </Button>
      </form>
      {login.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {loginErrorMessage(login.error)}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 text-sm sm:flex-row sm:justify-between">
        <Link to="/signup" className="underline">
          Crear una cuenta
        </Link>
        <Link to="/forgot-password" className="underline">
          He olvidado mi contraseña
        </Link>
      </div>
    </main>
  );
}
