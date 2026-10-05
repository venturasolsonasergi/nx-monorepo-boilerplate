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

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => mockNavigate,
}));

vi.mock('../api/auth.api', () => ({
  authApi: { login: vi.fn() },
}));

import { authApi } from '../api/auth.api';
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

  it('updates the session and continues to /users on success', async () => {
    login.mockResolvedValue({ userId: 'user-1', status: 'authenticated' });
    const client = renderPage();
    submit();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/users' }),
    );
    expect(client.getQueryData(sessionQueryKey)).toEqual({
      userId: 'user-1',
      status: 'authenticated',
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
