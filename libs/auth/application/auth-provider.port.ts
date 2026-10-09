import type { RequestContext } from './request-context';

export interface AuthenticatedSession {
  userId: string;
  email: string;
  emailVerified: boolean;
}

export interface SessionResult {
  session: AuthenticatedSession;
  setCookie: string[];
}

export interface OAuthStartResult {
  authorizationUrl: string;
  setCookie: string[];
}

export interface OAuthCallbackResult {
  redirectUrl: string;
  setCookie: string[];
}

export interface CompleteOAuthInput {
  provider: string;
  query: Record<string, string>;
  cookieHeader: string | undefined;
  context: RequestContext;
}

export interface ChangePasswordInput {
  cookieHeader: string | undefined;
  currentPassword: string;
  newPassword: string;
}

export interface AuthProvider {
  login(
    input: { email: string; password: string },
    context: RequestContext,
  ): Promise<SessionResult>;
  logout(
    cookieHeader: string | undefined,
    context: RequestContext,
  ): Promise<string[]>;
  refresh(
    cookieHeader: string | undefined,
    context: RequestContext,
  ): Promise<SessionResult>;
  requestPasswordReset(email: string, context: RequestContext): Promise<void>;
  confirmPasswordReset(
    input: { token: string; password: string },
    context: RequestContext,
  ): Promise<void>;
  getSession(
    cookieHeader: string | undefined,
    context: RequestContext,
  ): Promise<AuthenticatedSession | null>;
  changePassword(
    input: ChangePasswordInput,
    context: RequestContext,
  ): Promise<string[]>;
  startOAuth(
    input: { provider: string; callbackURL: string },
    context: RequestContext,
  ): Promise<OAuthStartResult>;
  completeOAuth(input: CompleteOAuthInput): Promise<OAuthCallbackResult>;
}
