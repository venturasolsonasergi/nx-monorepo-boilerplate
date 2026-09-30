import { UserFormContainer } from '../components/user-form.container';
import { UsersListContainer } from '../components/users-list.container';

// Lazily loaded via lazyRouteComponent — must be the default export.
export default function UsersPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-lg font-semibold">Usuarios</h1>
      <UserFormContainer />
      <UsersListContainer />
    </div>
  );
}
