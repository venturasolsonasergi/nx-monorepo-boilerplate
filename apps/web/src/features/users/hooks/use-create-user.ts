import { useMutation } from '@tanstack/react-query';
import { usersApi } from '../api/users.api';
import type { CreateProfileInput } from '../api/users.schema';

export function useCreateUser() {
  return useMutation({
    mutationFn: (input: CreateProfileInput) => usersApi.create(input),
  });
}
