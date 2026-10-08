import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/lib/api-client';
import { sessionQueryKey } from '../../../shared/lib/query-keys';

const mockNavigate = vi.fn();
const mockSearch: { current: Record<string, unknown> } = { current: {} };

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => mockNavigate,
  useSearch: () => mockSearch.current,
}));

vi.mock('../api/auth.api', () => ({
  authApi: { login: vi.fn() },
}));

vi.mock('../../../shared/i18n/routing', () => ({
  switchLocale: vi.fn(),
  ensureSignedInLanguage: vi.fn(),
}));

import { authApi } from '../api/auth.api';
import {
  ensureSignedInLanguage,
  switchLocale,
} from '../../../shared/i18n/routing';
import LoginPage from './login-page';

const login = vi.mocked(authApi.login);

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <LoginPage />
    </QueryClientProvider>,
  );
  return client;
}

function submit() {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), {
    target: { value: 'ana@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Contraseña'), {
    target: { value: 'password123' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Acceder' }));
}

afterEach(() => {
  cleanup();
  login.mockReset();
  mockNavigate.mockReset();
  mockSearch.current = {};
  vi.mocked(ensureSignedInLanguage).mockReset();
  vi.mocked(switchLocale).mockReset();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('LoginPage', () => {
  it('links to signup and password recovery', () => {
    renderPage();
    expect(
      screen.getByRole('link', { name: 'Crear una cuenta' }),
    ).toHaveAttribute('href', '/signup');
    expect(
      screen.getByRole('link', { name: 'He olvidado mi contraseña' }),
    ).toHaveAttribute('href', '/forgot-password');
  });

  it('shows invalid-credentials feedback on 401', async () => {
    login.mockRejectedValue(new ApiError(401, 'Invalid credentials'));
    renderPage();
    submit();
    expect(
      await screen.findByText('Correo o contraseña no válidos.'),
    ).toBeInTheDocument();
  });

  it('does not present a network failure as invalid credentials', async () => {
    login.mockRejectedValue(new TypeError('Failed to fetch'));
    renderPage();
    submit();
    expect(
      await screen.findByText(
        'No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Correo o contraseña no válidos.')).toBeNull();
  });

  it('shows a retry-waiting message, not invalid credentials, on 429', async () => {
    login.mockRejectedValue(new ApiError(429, 'rate limited'));
    renderPage();
    submit();
    expect(
      await screen.findByText(
        'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Correo o contraseña no válidos.')).toBeNull();
  });

  it('updates the session and continues to /dashboard on success', async () => {
    login.mockResolvedValue({ userId: 'user-1', status: 'authenticated' });
    const client = renderPage();
    submit();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/dashboard' }),
    );
    expect(client.getQueryData(sessionQueryKey)).toEqual({
      userId: 'user-1',
      status: 'authenticated',
    });
  });

  it('applies the stored language after login', async () => {
    login.mockResolvedValue({ userId: 'user-1', status: 'authenticated' });
    vi.mocked(ensureSignedInLanguage).mockResolvedValue('ca');
    renderPage();
    submit();

    await waitFor(() =>
      expect(switchLocale).toHaveBeenCalledWith('ca', expect.any(String)),
    );
  });

  it('applies the default language when none was stored', async () => {
    login.mockResolvedValue({ userId: 'user-1', status: 'authenticated' });
    vi.mocked(ensureSignedInLanguage).mockResolvedValue('en');
    renderPage();
    submit();

    await waitFor(() =>
      expect(switchLocale).toHaveBeenCalledWith('en', '/dashboard'),
    );
  });

  it('continues under the current locale when the settings read fails', async () => {
    login.mockResolvedValue({ userId: 'user-1', status: 'authenticated' });
    vi.mocked(ensureSignedInLanguage).mockResolvedValue(null);
    renderPage();
    submit();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/dashboard' }),
    );
    expect(switchLocale).not.toHaveBeenCalled();
  });

  it('continues to /dashboard when the returnTo is authorized', async () => {
    mockSearch.current = { returnTo: '/dashboard' };
    login.mockResolvedValue({ userId: 'user-1', status: 'authenticated' });
    renderPage();
    submit();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/dashboard' }),
    );
  });

  it('discards an unauthorized returnTo and continues to /dashboard', async () => {
    mockSearch.current = { returnTo: 'https://evil.example.com' };
    login.mockResolvedValue({ userId: 'user-1', status: 'authenticated' });
    renderPage();
    submit();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/dashboard' }),
    );
    expect(mockNavigate).not.toHaveBeenCalledWith({
      to: 'https://evil.example.com',
    });
  });

  it('does not persist session material in browser storage', async () => {
    login.mockResolvedValue({ userId: 'user-1', status: 'authenticated' });
    renderPage();
    submit();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});
