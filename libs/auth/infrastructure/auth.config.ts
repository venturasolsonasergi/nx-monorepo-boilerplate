export interface SocialProviderConfig {
  clientId: string;
  clientSecret: string;
}

export interface TestOAuthProviderConfig {
  providerId: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
}

export interface AuthConfig {
  secret: string;
  baseURL: string;
  webURL: string;
  basePath: string;
  trustedOrigins: string[];
  allowedProviders: string[];
  socialProviders: Record<string, SocialProviderConfig>;
  testOAuthProvider?: TestOAuthProviderConfig;
}

export const AUTH_CONFIG = Symbol('AUTH_CONFIG');
export const AUTH_ALLOWED_PROVIDERS = Symbol('AUTH_ALLOWED_PROVIDERS');
export const AUTH_PROVIDER = Symbol('AUTH_PROVIDER');
export const MAIL_PORT = Symbol('MAIL_PORT');

export function loadAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): AuthConfig {
  const baseURL = env.AUTH_BASE_URL ?? 'http://localhost:3000';
  const webURL = env.AUTH_WEB_URL ?? 'http://localhost:4200';
  const secret = env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET must be configured for the auth service');
  }

  const socialProviders: Record<string, SocialProviderConfig> = {};
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    };
  }
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    socialProviders.github = {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    };
  }

  const trustedOrigins = (env.AUTH_TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return {
    secret,
    baseURL,
    webURL,
    basePath: '/auth',
    trustedOrigins: Array.from(new Set([webURL, baseURL, ...trustedOrigins])),
    allowedProviders: Object.keys(socialProviders),
    socialProviders,
  };
}
