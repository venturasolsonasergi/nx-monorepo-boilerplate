import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api/auth.api';

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (email: string) => authApi.requestPasswordReset({ email }),
  });
}
