import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../auth/hooks/use-session', () => ({
  useSessionState: vi.fn(),
}));

vi.mock('../hooks/use-user-settings', () => ({
  useUserSettings: vi.fn(),
}));

vi.mock('../api/settings.api', () => ({
  settingsApi: { get: vi.fn(), update: vi.fn() },
}));

import { useSessionState } from '../../auth/hooks/use-session';
import { settingsApi } from '../api/settings.api';
import { useUserSettings } from '../hooks/use-user-settings';
import { ThemeProvider } from '../../../shared/theming';
import { ThemePreference } from './theme-preference';

const mockSession = vi.mocked(useSessionState);
const mockUseUserSettings = vi.mocked(useUserSettings);
const mockUpdate = vi.mocked(settingsApi.update);

function installMatchMedia(dark = false) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: dark && query === '(prefers-color-scheme: dark)',
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <ThemePreference />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

function isDark() {
  return document.documentElement.classList.contains('dark');
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.className = '';
  installMatchMedia(false);
  mockSession.mockReturnValue({
    state: 'authenticated',
    userId: 'user-1',
    error: null,
    refetch: vi.fn(),
  });
  mockUseUserSettings.mockReturnValue({
    data: { language: 'es', theme: 'system' },
  } as unknown as ReturnType<typeof useUserSettings>);
  mockUpdate.mockResolvedValue({ language: 'es', theme: 'dark' });
});

afterEach(() => {
  cleanup();
  mockSession.mockReset();
  mockUseUserSettings.mockReset();
  mockUpdate.mockReset();
  vi.restoreAllMocks();
});

describe('ThemePreference', () => {
  it('applies the selection locally and persists it through the settings API', async () => {
    renderSection();

    fireEvent.click(screen.getByRole('radio', { name: 'Oscuro' }));

    expect(isDark()).toBe(true);
    expect(screen.getByRole('radio', { name: 'Oscuro' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith({
        language: 'es',
        theme: 'dark',
      }),
    );
  });

  it('keeps the session choice when persistence fails', async () => {
    mockUpdate.mockRejectedValue(new Error('offline'));
    renderSection();

    fireEvent.click(screen.getByRole('radio', { name: 'Oscuro' }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(isDark()).toBe(true);
    expect(screen.getByRole('radio', { name: 'Oscuro' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('offers the three explicit options', () => {
    renderSection();

    expect(screen.getByRole('radio', { name: 'Claro' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Oscuro' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Sistema' })).toBeInTheDocument();
  });
});
