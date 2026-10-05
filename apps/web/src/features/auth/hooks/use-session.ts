import { useQuery } from '@tanstack/react-query';
import { isUnauthenticatedError } from '../../../shared/lib/api-client';
import { sessionQueryKey } from '../../../shared/lib/query-keys';
import { authApi } from '../api/auth.api';

export { sessionQueryKey };

export type SessionState =
  'pending' | 'authenticated' | 'unauthenticated' | 'unknown';

// Resolves the current verified browser session. A 401 means "not logged in";
// any other failure is an unknown state that is not the same as being signed out.
export function useSession() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: authApi.getSession,
    retry: false,
  });
}

export interface SessionStatus {
  state: SessionState;
  userId: string | null;
  error: unknown;
  refetch: () => void;
}

export function useSessionState(): SessionStatus {
  const query = useSession();
  const refetch = () => {
    void query.refetch();
  };

  if (query.isPending) {
    return { state: 'pending', userId: null, error: null, refetch };
  }

  if (query.isSuccess) {
    const data = query.data as { userId: string } | null | undefined;
    if (!data?.userId) {
      // Logout writes a null sentinel so active observers render the anonymous
      // state before the session is revalidated.
      return { state: 'unauthenticated', userId: null, error: null, refetch };
    }
    return {
      state: 'authenticated',
      userId: data.userId,
      error: null,
      refetch,
    };
  }

  return {
    state: isUnauthenticatedError(query.error) ? 'unauthenticated' : 'unknown',
    userId: null,
    error: query.error,
    refetch,
  };
}
