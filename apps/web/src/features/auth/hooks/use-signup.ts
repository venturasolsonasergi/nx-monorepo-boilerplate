import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api/auth.api';

// Signup only creates a pending registration for an email; it never creates a
// password, session, or profile.
export function useSignup() {
  return useMutation({
    mutationFn: (input: { email: string }) => authApi.signup(input),
  });
}
