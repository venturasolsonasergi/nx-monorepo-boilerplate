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

// Public response shapes mirror libs/auth/specs/openapi.yaml.
export const signupResponseSchema = z.object({
  userId: z.string().min(1),
  status: z.literal('pending-verification'),
});
export const loginResponseSchema = z.object({
  userId: z.string().min(1),
  status: z.literal('authenticated'),
});
export const passwordResetRequestResponseSchema = z.object({
  status: z.literal('accepted'),
  message: z.string(),
});
export const logoutResponseSchema = z.object({ status: z.literal('ok') });

export interface Credentials {
  email: string;
  password: string;
}

export interface PasswordResetConfirmation {
  token: string;
  password: string;
}

// The only place in the feature that knows the auth HTTP contract with apps/api.
export const authApi = {
  signup: (input: Credentials) =>
    apiClient.post('/auth/signup', signupResponseSchema, input),
  login: (input: Credentials) =>
    apiClient.post('/auth/login', loginResponseSchema, input),
  logout: () => apiClient.post('/auth/logout', logoutResponseSchema, undefined),
  requestPasswordReset: (input: { email: string }) =>
    apiClient.post(
      '/auth/reset-password/request',
      passwordResetRequestResponseSchema,
      input,
    ),
  confirmPasswordReset: (input: PasswordResetConfirmation) =>
    apiClient.post('/auth/reset-password/confirm', statusSchema, input),
  startOAuth: (provider: string) =>
    apiClient.post(`/auth/oauth/${provider}`, oauthStartSchema, {}),
  // POST /auth/refresh only succeeds for an active, verified browser session;
  // a 401 means the caller is not logged in.
  getSession: () => apiClient.post('/auth/refresh', sessionSchema, {}),
};
