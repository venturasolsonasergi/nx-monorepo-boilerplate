import { useMutation, useQueryClient } from '@tanstack/react-query';
import { clearPrivateCaches } from '../../../shared/lib/private-cache';
import { authApi } from '../api/auth.api';

// Ends the session and clears all private caches so a later user cannot see the
// previous user's session or profile data.
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => clearPrivateCaches(queryClient),
  });
}
