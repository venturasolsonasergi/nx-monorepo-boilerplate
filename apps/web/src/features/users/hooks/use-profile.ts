import { useQuery } from '@tanstack/react-query';
import { profileQueryKey } from '../../../shared/lib/query-keys';
import { usersApi } from '../api/users.api';

// The profile query is keyed by the authenticated userId so a different user
// never reads another user's cached profile.
export function useProfile(userId: string) {
  return useQuery({
    queryKey: profileQueryKey(userId),
    queryFn: usersApi.getCurrent,
    retry: false,
  });
}
