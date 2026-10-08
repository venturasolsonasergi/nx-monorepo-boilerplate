import { useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsQueryKey } from '../../../shared/lib/query-keys';
import { settingsApi } from '../api/settings.api';
import type { UserSettings } from '../api/settings.schema';

// Persists the signed-in user's language preference. The settings query is
// keyed by userId; a successful update refreshes the current user's entry.
export function useUpdateSettings(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UserSettings) => settingsApi.update(input),
    onSuccess: (data) => {
      if (userId) {
        queryClient.setQueryData(settingsQueryKey(userId), data);
      }
    },
  });
}
