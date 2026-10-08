import {
  DEFAULT_LOCALE,
  DEFAULT_USER_LANGUAGE,
  detectPreferredLocale,
  isSupportedLocale,
  type Locale,
} from './config';

const SETTINGS_PATH = '/users/me/settings';

const KNOWN_FIRST_SEGMENTS = new Set([
  '',
  'login',
  'signup',
  'complete-signup',
  'forgot-password',
  'reset-password',
  'auth',
  'verified',
  'dashboard',
  'users',
  'settings',
]);

export function localizedPath(locale: Locale, path: string): string {
  const rest = path.replace(/^\//, '');
  return rest ? `/${locale}/${rest}` : `/${locale}`;
}

export function parseLocaleFromPathname(pathname: string): {
  locale: Locale | undefined;
  pathname: string;
} {
  const parts = pathname.split('/');
  const first = parts[1];
  if (parts.length > 1 && first !== undefined && isSupportedLocale(first)) {
    return { locale: first, pathname: `/${parts.slice(2).join('/')}` };
  }
  return { locale: undefined, pathname };
}

export function resolveLocaleRedirect(
  pathname: string,
  detected: Locale,
): string | null {
  const { locale, pathname: rest } = parseLocaleFromPathname(pathname);
  if (locale) return null; // already has a locale
  const segments = rest.split('/');
  const first = segments[1] ?? '';
  if (KNOWN_FIRST_SEGMENTS.has(first)) {
    return localizedPath(detected, rest);
  }
  // unsupported locale or unknown path: drop the first segment
  if (segments.length > 1) {
    return localizedPath(detected, `/${segments.slice(2).join('/')}`);
  }
  return localizedPath(detected, '/');
}

export function switchLocale(newLocale: Locale, currentPathname: string): void {
  const { pathname } = parseLocaleFromPathname(currentPathname);
  const target = localizedPath(newLocale, pathname);
  window.location.assign(target);
}

// Reads the signed-in caller's stored language. `'none'` means the caller is
// authenticated but has no settings; `null` means not authenticated or unknown.
export type SignedInLanguage = Locale | 'none' | null;

export async function fetchSignedInLanguage(): Promise<SignedInLanguage> {
  try {
    const response = await fetch(SETTINGS_PATH, { credentials: 'include' });
    if (response.status === 404) {
      return 'none';
    }
    if (!response.ok) {
      return null;
    }
    const data: unknown = await response.json();
    const language =
      data && typeof data === 'object'
        ? (data as { language?: unknown }).language
        : undefined;
    return typeof language === 'string' && isSupportedLocale(language)
      ? language
      : null;
  } catch {
    return null;
  }
}

async function createDefaultUserLanguage(): Promise<void> {
  try {
    await fetch(SETTINGS_PATH, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: DEFAULT_USER_LANGUAGE }),
    });
  } catch {
    // Best effort; the caller still applies the default language.
  }
}

// Ensures a signed-in caller has a stored language, creating the default when
// none exists, and returns it. Returns null when the caller is not signed in or
// the read is inconclusive, so the caller keeps the locale already in effect.
export async function ensureSignedInLanguage(): Promise<Locale | null> {
  const stored = await fetchSignedInLanguage();
  if (stored === 'none') {
    await createDefaultUserLanguage();
    return DEFAULT_USER_LANGUAGE;
  }
  return stored;
}

// Resolves the locale for the initial load. When a signed-in caller has a stored
// language it is authoritative and the URL is brought to it, even when the URL
// carries a different supported prefix. A signed-in caller without settings gets
// the default (created). Anonymous visitors keep a supported URL prefix, else the
// browser language, else the default.
export async function resolveInitialLocale(): Promise<Locale> {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE;
  }

  const { locale: urlLocale, pathname } = parseLocaleFromPathname(
    window.location.pathname,
  );

  const stored = await fetchSignedInLanguage();
  let chosen: Locale;
  if (stored === 'none') {
    await createDefaultUserLanguage();
    chosen = DEFAULT_USER_LANGUAGE;
  } else if (stored) {
    chosen = stored;
  } else {
    chosen = urlLocale ?? detectPreferredLocale();
  }

  if (urlLocale !== chosen) {
    const target =
      resolveLocaleRedirect(window.location.pathname, chosen) ??
      localizedPath(chosen, pathname);
    window.history.replaceState(
      null,
      '',
      `${target}${window.location.search}${window.location.hash}`,
    );
  }
  return chosen;
}
