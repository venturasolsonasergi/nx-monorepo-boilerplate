import { Link } from '@tanstack/react-router';

// Landed here after the OAuth provider callback (the API redirects with the
// session cookie already set, or with ?error=<code> when it fails).
export default function OAuthCallbackPage() {
  const error = new URLSearchParams(window.location.search).get('error');

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-lg font-semibold">Inicio de sesión con proveedor</h1>
      {error ? (
        <p className="text-sm text-red-600">
          No se pudo completar el inicio de sesión ({error}).
        </p>
      ) : (
        <p className="text-sm text-green-700">Sesión iniciada correctamente.</p>
      )}
      <Link to="/users" className="text-sm underline">
        Continuar
      </Link>
    </div>
  );
}
