import { Link } from '@tanstack/react-router';
import { useSession } from '../../auth';
import { UserFormContainer } from '../components/user-form.container';
import { Spinner } from '../../../shared/ui/spinner';

// Lazily loaded via lazyRouteComponent — must be the default export.
// Profile creation requires a verified login, so the form is only rendered for
// an active session; POST /users is never attempted otherwise.
export default function UsersPage() {
  const { isPending, isError } = useSession();

  if (isPending) {
    return <Spinner />;
  }

  if (isError) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h1 className="text-lg font-semibold">Perfil</h1>
        <p className="text-sm text-muted-foreground">
          Necesitas iniciar sesión con un correo verificado antes de crear tu
          perfil.
        </p>
        <Link to="/verified" className="text-sm underline">
          Verificar correo e iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-lg font-semibold">Crear perfil</h1>
      <UserFormContainer />
    </div>
  );
}
