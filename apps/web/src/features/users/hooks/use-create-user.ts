import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../api/users.api';
import { usersQueryKeys } from './use-users';
import type { CreateUserInput } from '../api/users.schema';

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateUserInput) => usersApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: usersQueryKeys.all });
    },
  });
}
