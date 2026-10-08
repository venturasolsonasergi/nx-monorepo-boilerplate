import { useQuery } from '@tanstack/react-query';
import { settingsQueryKey } from '../../../shared/lib/query-keys';
import { settingsApi } from '../api/settings.api';

// The settings query is keyed by the authenticated userId so a different user
// never reads another user's cached settings.
export function useUserSettings(userId: string | null) {
  return useQuery({
    queryKey: settingsQueryKey(userId ?? ''),
    queryFn: settingsApi.get,
    enabled: Boolean(userId),
    retry: false,
  });
}
