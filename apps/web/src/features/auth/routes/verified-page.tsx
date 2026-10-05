import { Link } from '@tanstack/react-router';

// Landed here from the emailed verification link (GET /auth/verify-email).
// Verification does not start a session, so the next step is signing in.
export default function VerifiedPage() {
  const params = new URLSearchParams(window.location.search);
  const verified = params.get('verified') === 'true';
  const error = params.get('error');

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-lg font-semibold">Verificación de correo</h1>
      {verified ? (
        <p className="text-sm text-green-700">
          Tu correo se ha verificado correctamente.
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600">
          No se pudo verificar el correo ({error}).
        </p>
      ) : null}
      <Link to="/login" className="text-sm underline">
        Iniciar sesión
      </Link>
    </main>
  );
}
