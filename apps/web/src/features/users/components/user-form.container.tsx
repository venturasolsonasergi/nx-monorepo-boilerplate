import { useCreateUser } from '../hooks/use-create-user';
import { UserForm } from './user-form';

// Container: wires the mutation into the presentational form.
export function UserFormContainer({ userId }: { userId: string }) {
  const { mutate, isPending } = useCreateUser(userId);

  return (
    <UserForm onSubmit={(input) => mutate(input)} isSubmitting={isPending} />
  );
}
