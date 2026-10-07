import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { signupErrorMessage, resendErrorMessage } from '../lib/auth-messages';
import { useSignup } from '../hooks/use-signup';
import { useResendVerification } from '../hooks/use-resend-verification';
import { usePublicConfig } from '../hooks/use-public-config';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [resendUntil, setResendUntil] = useState<number | null>(null);
  const signup = useSignup();
  const resend = useResendVerification();
  const config = usePublicConfig();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const data = signup.data;
  useEffect(() => {
    if (data?.emailStatus === 'throttled' && data.retryAfterSeconds) {
      setResendUntil(Date.now() + data.retryAfterSeconds * 1000);
    } else if (data) {
      setResendUntil(null);
    }
  }, [data]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    signup.mutate({ email });
  }

  function handleResend() {
    resend.mutate(
      { email },
      {
        onSuccess: (response) => {
          if (response.retryAfterSeconds) {
            setResendUntil(Date.now() + response.retryAfterSeconds * 1000);
          }
        },
      },
    );
  }

  function restart() {
    signup.reset();
    resend.reset();
    setResendUntil(null);
    setEmail('');
  }

  const support = config.data?.supportEmail ?? null;

  if (data) {
    const deadline = new Date(data.expiresAt).getTime();
    const expired = now >= deadline;
    const resendBlocked =
      resend.isPending || (resendUntil !== null && now < resendUntil);

    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h1 className="text-lg font-semibold">Revisa tu correo</h1>
        {expired ? (
          <p className="text-sm text-muted-foreground">
            El plazo de activación de 48 horas ha caducado. Inicia el registro
            de nuevo.
          </p>
        ) : (
          <>
            {data.emailStatus === 'accepted' ? (
              <p className="text-sm text-muted-foreground">
                Hemos enviado un enlace de activación a tu correo. Ábrelo para
                elegir tu contraseña.
              </p>
            ) : data.emailStatus === 'failed' ? (
              <p className="text-sm text-destructive">
                No se pudo enviar el correo de activación. Puedes solicitar un
                reenvío o contactar con soporte.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Se han solicitado demasiados envíos recientes. Espera antes de
                pedir otro.
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              El enlace caduca el {new Date(data.expiresAt).toLocaleString()}.
            </p>
          </>
        )}

        {expired ? (
          <Button type="button" onClick={restart}>
            Iniciar registro de nuevo
          </Button>
        ) : (
          <Button type="button" onClick={handleResend} disabled={resendBlocked}>
            {resend.isPending ? 'Enviando…' : 'Reenviar enlace'}
          </Button>
        )}

        {resend.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {resendErrorMessage(resend.error)}
          </p>
        ) : null}
        {resendUntil !== null && now < resendUntil && !expired ? (
          <p className="text-sm text-muted-foreground">
            Podrás reenviar de nuevo en unos segundos.
          </p>
        ) : null}
        {support ? (
          <a href={`mailto:${support}`} className="text-sm underline">
            ¿No recibes el correo? Contacta con soporte
          </a>
        ) : null}
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
        <Button type="submit" disabled={signup.isPending}>
          {signup.isPending ? 'Enviando…' : 'Crear cuenta'}
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
