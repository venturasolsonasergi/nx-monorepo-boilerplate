export const THEME_STORAGE_KEY = 'nx.theme';

export const THEMES = ['light', 'dark', 'system'] as const;

export type ThemePreference = (typeof THEMES)[number];

export type ResolvedTheme = 'light' | 'dark';

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function isThemePreference(value: unknown): value is ThemePreference {
  return (
    typeof value === 'string' && (THEMES as readonly string[]).includes(value)
  );
}

// Reads the cached preference. An absent or unreadable value returns null so the
// caller resolves through the operating system, matching the pre-paint script.
export function readCachedTheme(): ThemePreference | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeCachedTheme(theme: ThemePreference): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable (e.g. private mode); the session still applies.
  }
}

export function getSystemTheme(): ResolvedTheme {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return 'light';
  }

  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

interface MediaQueryListener {
  addEventListener: (type: 'change', listener: () => void) => void;
  removeEventListener: (type: 'change', listener: () => void) => void;
}

export function getSystemThemeMedia(): MediaQueryListener | null {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return null;
  }

  return window.matchMedia(DARK_QUERY);
}

// A cached `light`/`dark` is authoritative; `system`, null, and invalid values
// resolve through the operating system color scheme.
export function resolveTheme(
  preference: ThemePreference | null,
): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') {
    return preference;
  }

  return getSystemTheme();
}

export function applyTheme(theme: ResolvedTheme): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.classList.toggle('dark', theme === 'dark');
}
