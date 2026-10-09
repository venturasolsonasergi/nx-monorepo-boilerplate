import type { QueryClient } from '@tanstack/react-query';
import {
  accountQueryKey,
  profileQueryPrefix,
  sessionQueryKey,
} from './query-keys';

// Ends the private cache: drops every user's profile and account summary and
// marks the session as logged out, then revalidates so active observers move to
// the anonymous state.
export async function clearPrivateCaches(queryClient: QueryClient) {
  await queryClient.cancelQueries({ queryKey: sessionQueryKey });
  await queryClient.cancelQueries({ queryKey: profileQueryPrefix });
  await queryClient.cancelQueries({ queryKey: accountQueryKey });
  queryClient.removeQueries({ queryKey: profileQueryPrefix });
  queryClient.removeQueries({ queryKey: accountQueryKey });
  queryClient.setQueryData(sessionQueryKey, null);
  await queryClient.invalidateQueries({ queryKey: sessionQueryKey });
}
