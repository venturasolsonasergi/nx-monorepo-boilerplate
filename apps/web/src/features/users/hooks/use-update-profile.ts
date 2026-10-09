import { useMutation, useQueryClient } from '@tanstack/react-query';
import { profileQueryKey } from '../../../shared/lib/query-keys';
import type { CreateProfileInput, Profile } from '../api/users.schema';
import { usersApi } from '../api/users.api';

// Updates the caller's own profile. The profile cache is written with the
// server's validated response so the settings display reflects the saved values
// immediately.
export function useUpdateProfile(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProfileInput): Promise<Profile> =>
      usersApi.update(input),
    onSuccess: (updated) => {
      queryClient.setQueryData(profileQueryKey(userId), updated);
    },
  });
}
