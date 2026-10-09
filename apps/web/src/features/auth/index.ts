// Public API for consumers of the auth feature, including other features.
export { createAuthRoutes } from './routes/auth.routes';
export { useSession, useSessionState } from './hooks/use-session';
export { useLogout } from './hooks/use-logout';
export { useAccount } from './hooks/use-account';
export { useChangePassword } from './hooks/use-change-password';
export type { PasswordChangeInput } from './api/auth.api';
export type { SessionState, SessionStatus } from './hooks/use-session';
