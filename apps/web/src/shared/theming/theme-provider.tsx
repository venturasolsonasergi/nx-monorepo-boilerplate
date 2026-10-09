import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useSessionState } from '../../features/auth/hooks/use-session';
import { useUserSettings } from '../../features/settings/hooks/use-user-settings';
import {
  applyTheme,
  getSystemThemeMedia,
  readCachedTheme,
  resolveTheme,
  writeCachedTheme,
  type ResolvedTheme,
  type ThemePreference,
} from './theme';

export interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  preference: 'system',
  resolvedTheme: 'light',
  setTheme: () => undefined,
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

// Owns the effective theme after boot: it initializes from the same cache the
// pre-paint script used, applies the resolved class, follows live OS scheme
// changes while the preference is `system`, and adopts a signed-in caller's
// stored theme once their settings response arrives.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { state, userId } = useSessionState();
  const settings = useUserSettings(state === 'authenticated' ? userId : null);

  const [preference, setPreference] = useState<ThemePreference>(
    () => readCachedTheme() ?? 'system',
  );
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(readCachedTheme()),
  );

  const setTheme = useCallback((theme: ThemePreference) => {
    writeCachedTheme(theme);
    setPreference(theme);
  }, []);

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    const recompute = () => setResolvedTheme(resolveTheme(preference));
    recompute();

    if (preference !== 'system') {
      return undefined;
    }

    const media = getSystemThemeMedia();
    if (!media) {
      return undefined;
    }

    media.addEventListener('change', recompute);
    return () => media.removeEventListener('change', recompute);
  }, [preference]);

  // The signed-in caller's stored theme is authoritative: adopt it and update
  // the cache whenever the settings response changes. Keying on the settings
  // data (not the preference) means a failed local selection is not reverted
  // until the next successful settings load.
  useEffect(() => {
    const stored = settings.data?.theme;
    if (stored) {
      setTheme(stored);
    }
  }, [settings.data, setTheme]);

  const value = useMemo(
    () => ({ preference, resolvedTheme, setTheme }),
    [preference, resolvedTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
