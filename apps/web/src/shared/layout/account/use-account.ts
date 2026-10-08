import { useLogout, useSessionState } from '../../../features/auth';
import type { SessionState } from '../../../features/auth';
import { useProfile } from '../../../features/users';

export interface Account {
  state: SessionState;
  userId: string | null;
  // Full display name derived from the shared profile query; null until it
  // resolves or when there is no authenticated user.
  displayName: string | null;
  refetch: () => void;
  logout: ReturnType<typeof useLogout>;
}

// One source of account logic for both the public header and the dashboard
// sidebar: it reuses the session state, the profile query, and logout instead of
// adding a second data source.
export function useAccount(): Account {
  const { state, userId, refetch } = useSessionState();
  const logout = useLogout();
  const profile = useProfile(userId);

  const displayName = profile.data
    ? `${profile.data.name} ${profile.data.surname}`
    : null;

  return { state, userId, displayName, refetch, logout };
}
