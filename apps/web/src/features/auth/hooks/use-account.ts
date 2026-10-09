import { useQuery } from '@tanstack/react-query';
import { accountQueryKey } from '../../../shared/lib/query-keys';
import { authApi } from '../api/auth.api';

// Discloses the session identity's account summary for the settings page. It
// stays disabled without a session, so no caller can trigger
// `GET /auth/account` while signed out.
export function useAccount(enabled: boolean) {
  return useQuery({
    queryKey: accountQueryKey,
    queryFn: authApi.account,
    enabled,
    retry: false,
  });
}
