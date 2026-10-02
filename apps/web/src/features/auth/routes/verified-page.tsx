import { Link } from '@tanstack/react-router';

// Landed here from the emailed verification link (GET /auth/verify-email).
export default function VerifiedPage() {
  const params = new URLSearchParams(window.location.search);
  const verified = params.get('verified') === 'true';
  const error = params.get('error');

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-lg font-semibold">Verificación de correo</h1>
      {verified ? (
        <p className="text-sm text-green-700">
          Tu correo se ha verificado correctamente. Ya puedes iniciar sesión.
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600">
          No se pudo verificar el correo ({error}).
        </p>
      ) : null}
      <Link to="/users" className="text-sm underline">
        Continuar
      </Link>
    </div>
  );
}
