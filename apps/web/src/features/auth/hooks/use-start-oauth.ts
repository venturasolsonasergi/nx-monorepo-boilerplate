import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api/auth.api';

// Starts the OAuth flow for a provider. On success the browser performs a
// full-page navigation to the provider's authorization URL (required because
// the destination is an external provider host). The start request always
// includes credentials so the state cookie is stored before leaving the app.
export function useStartOAuth() {
  return useMutation({
    mutationFn: (provider: string) => authApi.startOAuth(provider),
    onSuccess: (result) => {
      window.location.assign(result.authorizationUrl);
    },
  });
}
