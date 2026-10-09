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
const emailStatusSchema = z.enum(['accepted', 'failed', 'throttled']);
const retryAfterSchema = z.number().int().positive().optional();

// Public response shapes mirror libs/auth/specs/openapi.yaml.
export const signupResponseSchema = z.object({
  status: z.literal('pending-verification'),
  expiresAt: z.string().min(1),
  emailStatus: emailStatusSchema,
  retryAfterSeconds: retryAfterSchema,
});
export const resendVerificationResponseSchema = z.object({
  status: z.literal('accepted'),
  retryAfterSeconds: retryAfterSchema,
});
export const publicConfigResponseSchema = z.object({
  supportEmail: z.string().email().nullable(),
});
export const completeSignupResponseSchema = z.object({
  userId: z.string().min(1),
  status: z.literal('authenticated'),
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
// Mirrors the auth OpenAPI AccountSummaryResponse.
export const accountSummaryResponseSchema = z.object({
  email: z.string().email(),
  hasPassword: z.boolean(),
  passwordUpdatedAt: z.string().nullable(),
});
export const changePasswordResponseSchema = z.object({
  status: z.literal('ok'),
});

export type SignupResponse = z.infer<typeof signupResponseSchema>;
export type ResendVerificationResponse = z.infer<
  typeof resendVerificationResponseSchema
>;
export type PublicConfigResponse = z.infer<typeof publicConfigResponseSchema>;

export interface Credentials {
  email: string;
  password: string;
}

export interface PasswordResetConfirmation {
  token: string;
  password: string;
}

export interface PasswordChangeInput {
  currentPassword: string;
  newPassword: string;
}

// The only place in the feature that knows the auth HTTP contract with apps/api.
export const authApi = {
  signup: (input: { email: string }) =>
    apiClient.post('/auth/signup', signupResponseSchema, input),
  resendVerification: (input: { email: string }) =>
    apiClient.post(
      '/auth/verification/resend',
      resendVerificationResponseSchema,
      input,
    ),
  completeSignup: (input: { token: string; password: string }) =>
    apiClient.post(
      '/auth/signup/complete',
      completeSignupResponseSchema,
      input,
    ),
  getPublicConfig: () =>
    apiClient.get('/auth/public-config', publicConfigResponseSchema),
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
  // GET /auth/account discloses the session identity's email, whether a
  // password credential exists, and when the password was last changed. A 401
  // means the session is gone; any other failure is recoverable.
  account: () => apiClient.get('/auth/account', accountSummaryResponseSchema),
  // POST /auth/password/change revokes every session of the identity on
  // success, including the caller's, and issues no replacement cookie.
  changePassword: (input: PasswordChangeInput) =>
    apiClient.post(
      '/auth/password/change',
      changePasswordResponseSchema,
      input,
    ),
  startOAuth: (provider: string) =>
    apiClient.post(`/auth/oauth/${provider}`, oauthStartSchema, {}),
  // POST /auth/refresh only succeeds for an active, verified browser session;
  // a 401 means the caller is not logged in.
  getSession: () => apiClient.post('/auth/refresh', sessionSchema, {}),
};
