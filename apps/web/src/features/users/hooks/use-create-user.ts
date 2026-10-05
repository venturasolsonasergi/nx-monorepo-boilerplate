import { useMutation, useQueryClient } from '@tanstack/react-query';
import { profileQueryKey } from '../../../shared/lib/query-keys';
import { usersApi } from '../api/users.api';
import type { CreateProfileInput } from '../api/users.schema';

export function useCreateUser(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProfileInput) => usersApi.create(input),
    onSuccess: (profile) => {
      // Show the created profile instead of the empty form.
      queryClient.setQueryData(profileQueryKey(userId), profile);
    },
  });
}
