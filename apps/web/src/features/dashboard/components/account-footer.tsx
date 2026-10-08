import { Link, useNavigate } from '@tanstack/react-router';
import { LogIn, LogOut, RefreshCw, User as UserIcon } from 'lucide-react';
import { useAccount } from '../../../shared/layout/account/use-account';
import { cn } from '../../../shared/lib/cn';
import { Button } from '../../../shared/ui/button';
import { Spinner } from '../../../shared/ui/spinner';
import { useSidebar } from '../../../shared/ui/sidebar';
import { useLogoutTransition } from '../lib/logout-transition';

// Dashboard footer account control. It reuses the shared account unit and, on a
// successful logout, continues to the landing instead of the login page. When the
// sidebar is collapsed only icons are shown; each control keeps an accessible name.
export function AccountFooter() {
  const { state, displayName, refetch, logout } = useAccount();
  const navigate = useNavigate();
  const { setLoggingOut } = useLogoutTransition();
  const { state: sidebarState, isMobile } = useSidebar();
  const collapsed = sidebarState === 'collapsed' && !isMobile;

  const handleLogout = () => {
    setLoggingOut(true);
    logout.mutate(undefined, {
      onSuccess: () => {
        void navigate({ to: '/' });
      },
      onError: () => {
        setLoggingOut(false);
      },
    });
  };

  if (state === 'pending') {
    return (
      <div
        className={cn(
          'text-muted-foreground flex items-center gap-2 text-sm',
          collapsed && 'justify-center',
        )}
      >
        <Spinner />
        {collapsed ? null : <span>Comprobando sesión…</span>}
      </div>
    );
  }

  if (state === 'unknown') {
    if (collapsed) {
      return (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            aria-label="Reintentar sesión"
            onClick={refetch}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        <p role="alert" className="text-destructive text-xs">
          No se pudo comprobar la sesión.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={refetch}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (state === 'unauthenticated') {
    if (collapsed) {
      return (
        <div className="flex justify-center">
          <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Link to="/login" aria-label="Acceder">
              <LogIn className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      );
    }
    return (
      <Button asChild variant="outline" size="sm">
        <Link to="/login">Acceder</Link>
      </Button>
    );
  }

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1">
        <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Link to="/users" aria-label="Mi perfil">
            <UserIcon className="h-4 w-4" />
          </Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label="Cerrar sesión"
          disabled={logout.isPending}
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
        </Button>
        {logout.isError ? (
          <p role="alert" className="sr-only">
            No se pudo cerrar la sesión.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="truncate text-sm font-medium">{displayName ?? 'Sesión'}</p>
      <Button asChild variant="ghost" size="sm" className="justify-start">
        <Link to="/users">Mi perfil</Link>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="justify-start"
        disabled={logout.isPending}
        onClick={handleLogout}
      >
        Cerrar sesión
      </Button>
      {logout.isError ? (
        <p role="alert" className="text-destructive text-xs">
          No se pudo cerrar la sesión.
        </p>
      ) : null}
    </div>
  );
}
