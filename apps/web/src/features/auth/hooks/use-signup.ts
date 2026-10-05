import { useMutation } from '@tanstack/react-query';
import { authApi, type Credentials } from '../api/auth.api';

// Signup never creates a session or a profile; it only registers the identity.
export function useSignup() {
  return useMutation({
    mutationFn: (input: Credentials) => authApi.signup(input),
  });
}
