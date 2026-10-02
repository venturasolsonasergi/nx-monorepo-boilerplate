export interface AuthenticatedSession {
  userId: string;
  email: string;
  emailVerified: boolean;
}

export interface SignUpResult {
  userId: string;
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
}

export interface AuthProvider {
  signUp(input: { email: string; password: string }): Promise<SignUpResult>;
  verifyEmail(token: string): Promise<void>;
  login(input: { email: string; password: string }): Promise<SessionResult>;
  logout(cookieHeader: string | undefined): Promise<string[]>;
  refresh(cookieHeader: string | undefined): Promise<SessionResult>;
  requestPasswordReset(email: string): Promise<void>;
  confirmPasswordReset(input: {
    token: string;
    password: string;
  }): Promise<void>;
  getSession(
    cookieHeader: string | undefined,
  ): Promise<AuthenticatedSession | null>;
  startOAuth(input: {
    provider: string;
    callbackURL: string;
  }): Promise<OAuthStartResult>;
  completeOAuth(input: CompleteOAuthInput): Promise<OAuthCallbackResult>;
}
