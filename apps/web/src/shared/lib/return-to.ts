export const DASHBOARD_DESTINATION = '/dashboard';

// Only the exact `/dashboard` destination is authorized. Everything else —
// external URLs, protocol-relative hosts, other internal routes, null — is
// discarded so `returnTo` can never become an open redirect.
export function authorizedReturnTo(
  value: string | null | undefined,
): typeof DASHBOARD_DESTINATION | null {
  return value === DASHBOARD_DESTINATION ? DASHBOARD_DESTINATION : null;
}

export interface ReturnToSearch {
  returnTo?: string;
}

// Route-level search validator for the pages that understand `returnTo`.
export function validateReturnToSearch(
  search: Record<string, unknown>,
): ReturnToSearch {
  return {
    returnTo: typeof search.returnTo === 'string' ? search.returnTo : undefined,
  };
}
