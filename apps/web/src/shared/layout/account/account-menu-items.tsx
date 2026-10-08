import { Link } from '@tanstack/react-router';
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../../ui/dropdown-menu';
import type { Account } from './use-account';

// Dropdown items shared by the header's user menu. The dashboard sidebar footer
// renders the same account state with its own markup.
export function AccountMenuItems({ account }: { account: Account }) {
  const { state, refetch, logout } = account;

  if (state === 'authenticated') {
    return (
      <>
        <DropdownMenuItem asChild>
          <Link to="/users">Mi perfil</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/dashboard">Dashboard</Link>
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
    );
  }

  if (state === 'unauthenticated') {
    return (
      <DropdownMenuItem asChild>
        <Link to="/login">Acceder</Link>
      </DropdownMenuItem>
    );
  }

  return (
    <>
      <DropdownMenuLabel>No se pudo comprobar la sesión</DropdownMenuLabel>
      <DropdownMenuItem
        onSelect={() => {
          refetch();
        }}
      >
        Reintentar
      </DropdownMenuItem>
    </>
  );
}
