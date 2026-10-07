import { useQuery } from '@tanstack/react-query';
import { publicConfigQueryKey } from '../../../shared/lib/query-keys';
import { authApi } from '../api/auth.api';

// Public support contact. A failed fetch must not block signup/resend and must
// never fabricate a contact, so consumers treat an error as "no contact".
export function usePublicConfig() {
  return useQuery({
    queryKey: publicConfigQueryKey,
    queryFn: authApi.getPublicConfig,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
