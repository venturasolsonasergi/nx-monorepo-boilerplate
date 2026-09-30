import { useCreateUser } from '../hooks/use-create-user';
import { UserForm } from './user-form';

// Container: wires the mutation into the presentational form.
export function UserFormContainer() {
  const { mutate, isPending } = useCreateUser();

  return (
    <UserForm onSubmit={(input) => mutate(input)} isSubmitting={isPending} />
  );
}
