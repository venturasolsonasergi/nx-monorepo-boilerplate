import { useMutation, useQueryClient } from '@tanstack/react-query';
import { accountQueryKey } from '../../../shared/lib/query-keys';
import type { PasswordChangeInput } from '../api/auth.api';
import { authApi } from '../api/auth.api';

// A successful password change revokes every OTHER session of the identity and
// rotates the caller's, so the API sets a replacement session cookie and this
// device stays authenticated. The account summary is refreshed so the
// password's last-modified time is current.
export function useChangePassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: PasswordChangeInput) => authApi.changePassword(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: accountQueryKey }),
  });
}
