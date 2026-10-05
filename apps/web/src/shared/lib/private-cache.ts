import type { QueryClient } from '@tanstack/react-query';
import { profileQueryPrefix, sessionQueryKey } from './query-keys';

// Ends the private cache: drops every user's profile and marks the session as
// logged out, then revalidates so active observers move to the anonymous state.
export async function clearPrivateCaches(queryClient: QueryClient) {
  await queryClient.cancelQueries({ queryKey: sessionQueryKey });
  await queryClient.cancelQueries({ queryKey: profileQueryPrefix });
  queryClient.removeQueries({ queryKey: profileQueryPrefix });
  queryClient.setQueryData(sessionQueryKey, null);
  await queryClient.invalidateQueries({ queryKey: sessionQueryKey });
}
