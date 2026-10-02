import { useQuery } from '@tanstack/react-query';
import { authApi } from '../api/auth.api';

export const sessionQueryKey = ['auth', 'session'] as const;

// Resolves the current verified browser session. A missing session (401) makes
// the query fail, which callers treat as "not logged in".
export function useSession() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: authApi.getSession,
    retry: false,
  });
}
