import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api/auth.api';

// Requests a new activation link. The response is a uniform request
// acceptance; it never confirms whether the address exists or that mail was
// delivered.
export function useResendVerification() {
  return useMutation({
    mutationFn: (input: { email: string }) => authApi.resendVerification(input),
  });
}
