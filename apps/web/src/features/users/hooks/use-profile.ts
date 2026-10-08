import { useQuery } from '@tanstack/react-query';
import { profileQueryKey } from '../../../shared/lib/query-keys';
import { usersApi } from '../api/users.api';

// The profile query is keyed by the authenticated userId so a different user
// never reads another user's cached profile. It stays disabled without a userId,
// so no caller can trigger `GET /users/me` while signed out.
export function useProfile(userId: string | null) {
  return useQuery({
    queryKey: profileQueryKey(userId ?? ''),
    queryFn: usersApi.getCurrent,
    enabled: Boolean(userId),
    retry: false,
  });
}
