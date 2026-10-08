import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  profileQueryPrefix,
  sessionQueryKey,
} from '../../../shared/lib/query-keys';
import { authorizedReturnTo } from '../../../shared/lib/return-to';
import { authApi, type Credentials } from '../api/auth.api';

// On success, set the session to the signed-in user, drop any prior user's
// profile cache, revalidate the session, and continue to an authorized
// destination (only `/dashboard`) or to the profile route by default.
export function useLogin(returnTo?: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (input: Credentials) => authApi.login(input),
    onSuccess: async (data) => {
      queryClient.setQueryData(sessionQueryKey, data);
      queryClient.removeQueries({ queryKey: profileQueryPrefix });
      await queryClient.invalidateQueries({ queryKey: sessionQueryKey });
      await navigate({ to: authorizedReturnTo(returnTo) ?? '/users' });
    },
  });
}
