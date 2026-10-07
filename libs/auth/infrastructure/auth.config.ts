import type { VerificationLimits } from '../application/verification-limits';

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

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string | null;
  password: string | null;
  from: string;
}

export type VerificationLimitsConfig = VerificationLimits;

export interface AuthConfig {
  secret: string;
  baseURL: string;
  webURL: string;
  basePath: string;
  trustedOrigins: string[];
  allowedProviders: string[];
  socialProviders: Record<string, SocialProviderConfig>;
  testOAuthProvider?: TestOAuthProviderConfig;
  isProduction: boolean;
  supportEmail: string | null;
  smtp: SmtpConfig | null;
  verificationLimits: VerificationLimitsConfig;
  trustedProxies: string[];
}

export const AUTH_CONFIG = Symbol('AUTH_CONFIG');
export const AUTH_ALLOWED_PROVIDERS = Symbol('AUTH_ALLOWED_PROVIDERS');
export const AUTH_PROVIDER = Symbol('AUTH_PROVIDER');
export const MAIL_PORT = Symbol('MAIL_PORT');
export const SMTP_TRANSPORTER = Symbol('SMTP_TRANSPORTER');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

function parsePositiveInteger(
  value: string | undefined,
  name: string,
  fallback: number,
): number {
  if (value === undefined || value.trim().length === 0) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

function loadSmtpConfig(
  env: NodeJS.ProcessEnv,
  isProduction: boolean,
): SmtpConfig | null {
  const host = (env.SMTP_HOST ?? '').trim();
  if (host.length === 0) {
    if (isProduction) {
      throw new Error('SMTP_HOST must be configured in production');
    }

    return null;
  }

  const port = parsePositiveInteger(env.SMTP_PORT, 'SMTP_PORT', 587);
  if (port > 65535) {
    throw new Error('SMTP_PORT must be a valid TCP port');
  }

  const from =
    (env.MAIL_FROM ?? '').trim() ||
    (isProduction ? '' : 'no-reply@example.com');
  if (from.length === 0) {
    throw new Error('MAIL_FROM must be configured in production');
  }
  if (!isValidEmail(from)) {
    throw new Error('MAIL_FROM must be a valid email address');
  }

  const user = (env.SMTP_USER ?? '').trim();
  const password = env.SMTP_PASSWORD ?? '';

  return {
    host,
    port,
    secure: port === 465,
    user: user.length > 0 ? user : null,
    password: password.length > 0 ? password : null,
    from,
  };
}

function loadSupportEmail(
  env: NodeJS.ProcessEnv,
  isProduction: boolean,
): string | null {
  const supportEmail = (env.AUTH_SUPPORT_EMAIL ?? '').trim();
  if (supportEmail.length === 0) {
    if (isProduction) {
      throw new Error('AUTH_SUPPORT_EMAIL must be configured in production');
    }

    return null;
  }

  if (!isValidEmail(supportEmail)) {
    throw new Error('AUTH_SUPPORT_EMAIL must be a valid email address');
  }

  return supportEmail;
}

function loadVerificationLimits(
  env: NodeJS.ProcessEnv,
): VerificationLimitsConfig {
  const resendWindowSeconds = parsePositiveInteger(
    env.AUTH_VERIFICATION_RESEND_WINDOW_SECONDS,
    'AUTH_VERIFICATION_RESEND_WINDOW_SECONDS',
    60,
  );
  const sourceWindowSeconds = parsePositiveInteger(
    env.AUTH_VERIFICATION_SOURCE_WINDOW_SECONDS,
    'AUTH_VERIFICATION_SOURCE_WINDOW_SECONDS',
    3600,
  );
  const sourceMax = parsePositiveInteger(
    env.AUTH_VERIFICATION_SOURCE_MAX,
    'AUTH_VERIFICATION_SOURCE_MAX',
    20,
  );
  const retentionSeconds = parsePositiveInteger(
    env.AUTH_VERIFICATION_THROTTLE_RETENTION_SECONDS,
    'AUTH_VERIFICATION_THROTTLE_RETENTION_SECONDS',
    86400,
  );

  if (retentionSeconds < Math.max(resendWindowSeconds, sourceWindowSeconds)) {
    throw new Error(
      'AUTH_VERIFICATION_THROTTLE_RETENTION_SECONDS must be at least the longest configured verification window',
    );
  }

  return {
    resendWindowSeconds,
    sourceWindowSeconds,
    sourceMax,
    retentionSeconds,
  };
}

export function loadAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): AuthConfig {
  const baseURL = env.AUTH_BASE_URL ?? 'http://localhost:3000';
  const webURL = env.AUTH_WEB_URL ?? 'http://localhost:4200';
  const isProduction = env.NODE_ENV === 'production';
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

  const trustedProxies = (env.AUTH_TRUSTED_PROXIES ?? '')
    .split(',')
    .map((proxy) => proxy.trim())
    .filter((proxy) => proxy.length > 0);

  return {
    secret,
    baseURL,
    webURL,
    basePath: '/auth',
    trustedOrigins: Array.from(new Set([webURL, baseURL, ...trustedOrigins])),
    allowedProviders: Object.keys(socialProviders),
    socialProviders,
    isProduction,
    supportEmail: loadSupportEmail(env, isProduction),
    smtp: loadSmtpConfig(env, isProduction),
    verificationLimits: loadVerificationLimits(env),
    trustedProxies,
  };
}
