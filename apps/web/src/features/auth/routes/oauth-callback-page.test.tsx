import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/lib/api-client';
import {
  profileQueryPrefix,
  settingsQueryPrefix,
} from '../../../shared/lib/query-keys';

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => mockNavigate,
}));

vi.mock('../api/auth.api', () => ({
  authApi: { getSession: vi.fn() },
}));

import { authApi } from '../api/auth.api';
import OAuthCallbackPage from './oauth-callback-page';

const getSession = vi.mocked(authApi.getSession);

beforeEach(() => {
  window.history.pushState({}, '', '/auth/oauth/callback');
});

afterEach(() => {
  cleanup();
  mockNavigate.mockReset();
  getSession.mockReset();
});

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage(client = makeClient()) {
  render(
    <QueryClientProvider client={client}>
      <OAuthCallbackPage />
    </QueryClientProvider>,
  );
  return client;
}

describe('OAuthCallbackPage', () => {
  it('adopts the session, clears the previous private caches, and continues', async () => {
    getSession.mockResolvedValue({ userId: 'user-1', status: 'authenticated' });
    const client = makeClient();
    client.setQueryData([...profileQueryPrefix, 'previous'], { name: 'Old' });
    client.setQueryData([...settingsQueryPrefix, 'previous'], {
      language: 'ca',
    });

    renderPage(client);

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/settings',
        search: { returnTo: '/dashboard' },
      }),
    );
    expect(
      client.getQueryData([...profileQueryPrefix, 'previous']),
    ).toBeUndefined();
    expect(
      client.getQueryData([...settingsQueryPrefix, 'previous']),
    ).toBeUndefined();
  });

  it('shows the failure with the error value and a link to sign in', () => {
    window.history.pushState(
      {},
      '',
      '/auth/oauth/callback?error=access_denied',
    );
    getSession.mockResolvedValue({ userId: 'user-1', status: 'authenticated' });

    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent('access_denied');
    expect(
      screen.getByRole('link', { name: 'Ir a iniciar sesión' }),
    ).toHaveAttribute('href', '/login');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows a recoverable message when the session cannot be resolved', async () => {
    getSession.mockRejectedValue(new ApiError(401, 'Invalid session'));

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo confirmar tu sesión. Inicia sesión de nuevo.',
    );
    expect(
      screen.getByRole('link', { name: 'Ir a iniciar sesión' }),
    ).toHaveAttribute('href', '/login');
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
