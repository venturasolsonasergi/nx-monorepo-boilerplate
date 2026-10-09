import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../features/auth/hooks/use-session', () => ({
  useSessionState: vi.fn(),
}));

vi.mock('../../features/settings/hooks/use-user-settings', () => ({
  useUserSettings: vi.fn(),
}));

import { useSessionState } from '../../features/auth/hooks/use-session';
import { useUserSettings } from '../../features/settings/hooks/use-user-settings';
import { THEME_STORAGE_KEY } from './theme';
import { ThemeProvider, useTheme } from './theme-provider';

const mockSession = vi.mocked(useSessionState);
const mockSettings = vi.mocked(useUserSettings);

type Listener = (event: { matches: boolean }) => void;

function installMatchMedia(initialDark: boolean) {
  const listeners = new Set<Listener>();
  let dark = initialDark;

  const mediaQuery = {
    get matches() {
      return dark;
    },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (_type: string, listener: Listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: Listener) => {
      listeners.delete(listener);
    },
    addListener: (listener: Listener) => {
      listeners.add(listener);
    },
    removeListener: (listener: Listener) => {
      listeners.delete(listener);
    },
    dispatchEvent: () => true,
  };

  window.matchMedia = vi.fn().mockReturnValue(mediaQuery);

  return {
    setDark(next: boolean) {
      dark = next;
      listeners.forEach((listener) => listener({ matches: next }));
    },
  };
}

function Consumer() {
  const { preference, resolvedTheme } = useTheme();
  return <span data-testid="state">{`${preference}:${resolvedTheme}`}</span>;
}

function renderProvider() {
  return render(
    <ThemeProvider>
      <Consumer />
    </ThemeProvider>,
  );
}

function isDark() {
  return document.documentElement.classList.contains('dark');
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.className = '';
  mockSession.mockReturnValue({
    state: 'unauthenticated',
    userId: null,
    error: null,
    refetch: vi.fn(),
  });
  mockSettings.mockReturnValue({
    data: undefined,
  } as unknown as ReturnType<typeof useUserSettings>);
});

afterEach(() => {
  cleanup();
  mockSession.mockReset();
  mockSettings.mockReset();
  vi.restoreAllMocks();
});

describe('ThemeProvider', () => {
  it('renders dark from a cached dark preference', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    installMatchMedia(false);

    renderProvider();

    expect(isDark()).toBe(true);
  });

  it('follows the system scheme when there is no cache', () => {
    installMatchMedia(false);
    renderProvider();
    expect(isDark()).toBe(false);

    cleanup();
    document.documentElement.className = '';
    installMatchMedia(true);
    renderProvider();
    expect(isDark()).toBe(true);
  });

  it('falls back to the system scheme for an invalid cache', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    installMatchMedia(true);

    renderProvider();

    expect(isDark()).toBe(true);
    expect(screen.getByTestId('state')).toHaveTextContent('system:dark');
  });

  it('tracks live system changes while on system', () => {
    const media = installMatchMedia(false);
    renderProvider();
    expect(isDark()).toBe(false);

    act(() => media.setDark(true));

    expect(isDark()).toBe(true);
    expect(screen.getByTestId('state')).toHaveTextContent('system:dark');
  });

  it('adopts a stored theme over a differing cached value and updates the cache', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    installMatchMedia(false);
    mockSettings.mockReturnValue({
      data: { language: 'es', theme: 'dark' },
    } as unknown as ReturnType<typeof useUserSettings>);

    renderProvider();

    expect(isDark()).toBe(true);
    expect(screen.getByTestId('state')).toHaveTextContent('dark:dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('keeps the cached theme when the settings request is unavailable', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    installMatchMedia(true);
    mockSettings.mockReturnValue({
      data: undefined,
      isError: true,
    } as unknown as ReturnType<typeof useUserSettings>);

    renderProvider();

    expect(isDark()).toBe(true);
    expect(screen.getByTestId('state')).toHaveTextContent('dark:dark');
  });

  it('keeps the effective theme after the session signs out', () => {
    installMatchMedia(false);
    mockSession.mockReturnValue({
      state: 'authenticated',
      userId: 'user-1',
      error: null,
      refetch: vi.fn(),
    });
    mockSettings.mockReturnValue({
      data: { language: 'es', theme: 'dark' },
    } as unknown as ReturnType<typeof useUserSettings>);

    const { rerender } = renderProvider();
    expect(isDark()).toBe(true);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    // Signing out drops the session but must not clear the theme or its cache.
    mockSession.mockReturnValue({
      state: 'unauthenticated',
      userId: null,
      error: null,
      refetch: vi.fn(),
    });
    rerender(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );

    expect(isDark()).toBe(true);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(screen.getByTestId('state')).toHaveTextContent('dark:dark');
  });
});
