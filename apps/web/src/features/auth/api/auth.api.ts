import { z } from 'zod';
import { apiClient } from '../../../shared/lib/api-client';

const statusSchema = z.object({ status: z.string() });
const oauthStartSchema = z.object({
  provider: z.string(),
  authorizationUrl: z.string().url(),
});
const sessionSchema = z.object({
  userId: z.string().min(1),
  status: z.literal('authenticated'),
});

export interface PasswordResetConfirmation {
  token: string;
  password: string;
}

// The only place in the feature that knows the auth HTTP contract with apps/api.
export const authApi = {
  confirmPasswordReset: (input: PasswordResetConfirmation) =>
    apiClient.post('/auth/reset-password/confirm', statusSchema, input),
  startOAuth: (provider: string) =>
    apiClient.post(`/auth/oauth/${provider}`, oauthStartSchema, {}),
  // POST /auth/refresh only succeeds for an active, verified browser session;
  // a 401 means the caller is not logged in.
  getSession: () => apiClient.post('/auth/refresh', sessionSchema, {}),
};
