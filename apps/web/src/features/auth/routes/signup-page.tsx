import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { signupErrorMessage } from '../lib/auth-messages';
import { useSignup } from '../hooks/use-signup';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const signup = useSignup();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    signup.mutate({ email, password });
  }

  if (signup.isSuccess) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h1 className="text-lg font-semibold">Revisa tu correo</h1>
        <p className="text-sm text-muted-foreground">
          Hemos enviado un enlace de verificación a tu correo. Verifica la
          dirección antes de iniciar sesión.
        </p>
        <Link to="/login" className="text-sm underline">
          Ir a iniciar sesión
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-lg font-semibold">Crear una cuenta</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="signup-email" className="text-sm font-medium">
          Correo electrónico
        </label>
        <Input
          id="signup-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setEmail(event.target.value)
          }
          required
        />
        <label htmlFor="signup-password" className="text-sm font-medium">
          Contraseña
        </label>
        <Input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setPassword(event.target.value)
          }
          required
        />
        <Button type="submit" disabled={signup.isPending}>
          {signup.isPending ? 'Creando…' : 'Crear cuenta'}
        </Button>
      </form>
      {signup.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {signupErrorMessage(signup.error)}
        </p>
      ) : null}
      <Link to="/login" className="text-sm underline">
        Ya tengo una cuenta
      </Link>
    </main>
  );
}
