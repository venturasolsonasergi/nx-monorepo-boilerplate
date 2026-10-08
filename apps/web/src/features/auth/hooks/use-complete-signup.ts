import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  profileQueryPrefix,
  sessionQueryKey,
} from '../../../shared/lib/query-keys';
import { authApi } from '../api/auth.api';

// On success the identity is activated and session cookies are set. We drop any
// previous user's profile cache, mark the session authenticated, replace the
// token-bearing URL, and continue to /users to complete the profile in the same
// flow.
export function useCompleteSignup() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (input: { token: string; password: string }) =>
      authApi.completeSignup(input),
    onSuccess: async (data) => {
      queryClient.removeQueries({ queryKey: profileQueryPrefix });
      queryClient.setQueryData(sessionQueryKey, data);
      await queryClient.invalidateQueries({ queryKey: sessionQueryKey });
      await navigate({ to: '/settings', replace: true });
    },
  });
}
