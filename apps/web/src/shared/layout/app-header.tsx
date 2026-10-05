import { Link } from '@tanstack/react-router';
import { User as UserIcon } from 'lucide-react';
import { useLogout } from '../../features/auth/hooks/use-logout';
import { useSessionState } from '../../features/auth/hooks/use-session';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Spinner } from '../ui/spinner';
import { Wordmark } from '../ui/wordmark';

// Shared header for every route. The user control's menu reflects the resolved
// session state: pending, unauthenticated, authenticated, or unknown.
export function AppHeader() {
  const { state, refetch } = useSessionState();
  const logout = useLogout();

  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
      <Link to="/" className="text-sm">
        <Wordmark />
      </Link>
      <div className="flex items-center gap-3">
        {logout.isError ? (
          <div
            role="alert"
            className="flex items-center gap-2 text-xs text-destructive"
          >
            <span>No se pudo cerrar la sesión.</span>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
            >
              Reintentar
            </Button>
          </div>
        ) : null}
        {state === 'pending' ? (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            disabled
            aria-label="Comprobando sesión"
          >
            <Spinner />
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                aria-label="Cuenta de usuario"
              >
                <UserIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {state === 'authenticated' ? (
                <>
                  <DropdownMenuItem asChild>
                    <Link to="/users">Mi perfil</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled>
                    Dashboard
                    <span className="text-muted-foreground ml-auto text-xs">
                      Próximamente
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={logout.isPending}
                    onSelect={() => {
                      logout.mutate();
                    }}
                  >
                    Cerrar sesión
                  </DropdownMenuItem>
                </>
              ) : state === 'unauthenticated' ? (
                <DropdownMenuItem asChild>
                  <Link to="/login">Acceder</Link>
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuLabel>
                    No se pudo comprobar la sesión
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onSelect={() => {
                      refetch();
                    }}
                  >
                    Reintentar
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
