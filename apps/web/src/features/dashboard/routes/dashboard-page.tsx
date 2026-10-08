import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useSessionState } from '../../auth';
import {
  isNotFoundError,
  isUnauthenticatedError,
} from '../../../shared/lib/api-client';
import { clearPrivateCaches } from '../../../shared/lib/private-cache';
import { DASHBOARD_DESTINATION } from '../../../shared/lib/return-to';
import { Button } from '../../../shared/ui/button';
import { Spinner } from '../../../shared/ui/spinner';
import { ProfileView, useProfile } from '../../users';
import type { Profile } from '../../users';
import { useLogoutTransition } from '../lib/logout-transition';

// Lazily loaded via lazyRouteComponent — must be the default export.
export default function DashboardPage() {
  const { state, userId, refetch } = useSessionState();

  if (state === 'pending') {
    return <WorkspaceLoading />;
  }

  if (state === 'unauthenticated') {
    return <RedirectToLogin />;
  }

  if (state === 'unknown') {
    return <SessionUnknown onRetry={refetch} />;
  }

  return <ProfileSection userId={userId as string} />;
}

function ProfileSection({ userId }: { userId: string }) {
  const profile = useProfile(userId);

  if (profile.isPending) {
    return <WorkspaceLoading />;
  }

  if (profile.isError) {
    if (isUnauthenticatedError(profile.error)) {
      return <ExpiredSession />;
    }
    if (isNotFoundError(profile.error)) {
      return <RedirectToProfile />;
    }
    return <ProfileUnavailable onRetry={() => void profile.refetch()} />;
  }

  return <DashboardContent profile={profile.data} />;
}

function DashboardContent({ profile }: { profile: Profile }) {
  return (
    <main className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">
          Hola, {profile.name} {profile.surname}
        </h1>
        <p className="text-muted-foreground text-sm">
          Este es tu panel de trabajo.
        </p>
      </div>
      <section aria-labelledby="dashboard-profile-summary">
        <h2 id="dashboard-profile-summary" className="text-lg font-semibold">
          Resumen del perfil
        </h2>
        <div className="mt-3">
          <ProfileView profile={profile} />
        </div>
      </section>
      <div>
        <Link to="/users" className="text-sm underline">
          Mi perfil
        </Link>
      </div>
    </main>
  );
}

function WorkspaceLoading() {
  return (
    <main className="p-6" aria-label="Cargando panel">
      <Spinner />
    </main>
  );
}

function SessionUnknown({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex flex-col gap-3 p-6">
      <h1 className="text-lg font-semibold">Panel</h1>
      <p role="alert" className="text-destructive text-sm">
        No se pudo comprobar la sesión. Comprueba tu conexión e inténtalo de
        nuevo.
      </p>
      <Button type="button" variant="outline" onClick={onRetry}>
        Reintentar
      </Button>
    </main>
  );
}

function ProfileUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex flex-col gap-3 p-6">
      <h1 className="text-lg font-semibold">Panel</h1>
      <p role="alert" className="text-destructive text-sm">
        No se pudo cargar el perfil. Inténtalo de nuevo.
      </p>
      <Button type="button" variant="outline" onClick={onRetry}>
        Reintentar
      </Button>
    </main>
  );
}

function RedirectToLogin() {
  const navigate = useNavigate();
  const { loggingOut } = useLogoutTransition();
  useEffect(() => {
    if (loggingOut) {
      return;
    }
    void navigate({
      to: '/login',
      search: { returnTo: DASHBOARD_DESTINATION },
    });
  }, [navigate, loggingOut]);
  return <WorkspaceLoading />;
}

function RedirectToProfile() {
  const navigate = useNavigate();
  useEffect(() => {
    void navigate({
      to: '/users',
      search: { returnTo: DASHBOARD_DESTINATION },
    });
  }, [navigate]);
  return <WorkspaceLoading />;
}

function ExpiredSession() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    void clearPrivateCaches(queryClient).then(() => {
      void navigate({
        to: '/login',
        search: { returnTo: DASHBOARD_DESTINATION },
      });
    });
  }, [queryClient, navigate]);

  return <WorkspaceLoading />;
}
