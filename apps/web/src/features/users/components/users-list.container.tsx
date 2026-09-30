import { useUsers } from '../hooks/use-users';
import { UsersList } from './users-list';
import { Spinner } from '../../../shared/ui/spinner';

// Container: owns the query, delegates rendering to the presentational component.
export function UsersListContainer() {
  const { data, isPending, isError } = useUsers();

  if (isPending) {
    return <Spinner />;
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        No se pudieron cargar los usuarios.
      </p>
    );
  }

  return <UsersList users={data} />;
}
