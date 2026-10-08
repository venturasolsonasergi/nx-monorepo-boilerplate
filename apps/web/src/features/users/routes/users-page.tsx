import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useSessionState } from '../../auth';
import {
  isNotFoundError,
  isUnauthenticatedError,
} from '../../../shared/lib/api-client';
import { clearPrivateCaches } from '../../../shared/lib/private-cache';
import {
  authorizedReturnTo,
  validateReturnToSearch,
} from '../../../shared/lib/return-to';
import { Button } from '../../../shared/ui/button';
import { Spinner } from '../../../shared/ui/spinner';
import { ProfileView } from '../components/profile-view';
import { UserFormContainer } from '../components/user-form.container';
import { useProfile } from '../hooks/use-profile';
import type { Profile } from '../api/users.schema';

const PAGE = 'mx-auto flex max-w-2xl flex-col gap-6 p-6';

// Lazily loaded via lazyRouteComponent — must be the default export.
export default function UsersPage() {
  const { returnTo } = validateReturnToSearch(useSearch({ strict: false }));
  const { state, userId, refetch } = useSessionState();

  if (state === 'pending') {
    return (
      <main className={PAGE}>
        <Spinner />
      </main>
    );
  }

  if (state === 'unauthenticated') {
    return (
      <main className={PAGE}>
        <h1 className="text-lg font-semibold">Perfil</h1>
        <p className="text-sm text-muted-foreground">
          Necesitas iniciar sesión con un correo verificado para ver o crear tu
          perfil.
        </p>
        <Link to="/login" className="text-sm underline">
          Iniciar sesión
        </Link>
      </main>
    );
  }

  if (state === 'unknown') {
    return (
      <main className={PAGE}>
        <h1 className="text-lg font-semibold">Perfil</h1>
        <p role="alert" className="text-sm text-destructive">
          No se pudo comprobar la sesión. Comprueba tu conexión e inténtalo de
          nuevo.
        </p>
        <Button type="button" variant="outline" onClick={refetch}>
          Reintentar
        </Button>
      </main>
    );
  }

  return <ProfileSection userId={userId as string} returnTo={returnTo} />;
}

function ProfileSection({
  userId,
  returnTo,
}: {
  userId: string;
  returnTo?: string;
}) {
  const profile = useProfile(userId);
  const navigate = useNavigate();
  const destination = authorizedReturnTo(returnTo);

  // An authorized destination continues to `/dashboard` for both the existing
  // (200) and the created (201) profile, once the profile is available.
  useEffect(() => {
    if (destination && profile.isSuccess) {
      void navigate({ to: destination });
    }
  }, [destination, profile.isSuccess, navigate]);

  if (profile.isPending) {
    return (
      <main className={PAGE}>
        <Spinner />
      </main>
    );
  }

  if (profile.isError) {
    if (isUnauthenticatedError(profile.error)) {
      return <ExpiredSession />;
    }
    if (isNotFoundError(profile.error)) {
      return <CreateProfile userId={userId} />;
    }
    return <ProfileUnavailable onRetry={() => void profile.refetch()} />;
  }

  if (destination) {
    return (
      <main className={PAGE}>
        <Spinner />
      </main>
    );
  }

  return <ProfileContent profile={profile.data} />;
}

function ProfileContent({ profile }: { profile: Profile }) {
  return (
    <main className={PAGE}>
      <ProfileView profile={profile} />
    </main>
  );
}

function CreateProfile({ userId }: { userId: string }) {
  return (
    <main className={PAGE}>
      <h1 className="text-lg font-semibold">Crear perfil</h1>
      <UserFormContainer userId={userId} />
    </main>
  );
}

function ProfileUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <main className={PAGE}>
      <h1 className="text-lg font-semibold">Perfil</h1>
      <p role="alert" className="text-sm text-destructive">
        No se pudo cargar el perfil. Inténtalo de nuevo.
      </p>
      <Button type="button" variant="outline" onClick={onRetry}>
        Reintentar
      </Button>
    </main>
  );
}

function ExpiredSession() {
  const queryClient = useQueryClient();

  useEffect(() => {
    void clearPrivateCaches(queryClient);
  }, [queryClient]);

  return (
    <main className={PAGE}>
      <h1 className="text-lg font-semibold">Perfil</h1>
      <p className="text-sm text-muted-foreground">
        Tu sesión ha caducado. Vuelve a iniciar sesión.
      </p>
      <Link to="/login" className="text-sm underline">
        Iniciar sesión
      </Link>
    </main>
  );
}
