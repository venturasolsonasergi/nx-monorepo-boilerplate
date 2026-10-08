import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/lib/api-client';
import { profileQueryKey } from '../../../shared/lib/query-keys';

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => mockNavigate,
}));

vi.mock('../../auth', () => ({ useSessionState: vi.fn() }));

vi.mock('../../users/api/users.api', () => ({
  usersApi: { getCurrent: vi.fn() },
}));

import { useSessionState } from '../../auth';
import type { SessionStatus } from '../../auth';
import { usersApi } from '../../users/api/users.api';
import DashboardPage from './dashboard-page';

const mockSessionState = vi.mocked(useSessionState);
const getCurrent = vi.mocked(usersApi.getCurrent);

const profile = {
  id: 1,
  authUserId: 'A',
  name: 'Ana',
  surname: 'García',
  address: 'Calle 1',
  phone: '600000000',
};

function setSession(state: SessionStatus['state']) {
  mockSessionState.mockReturnValue({
    state,
    userId: state === 'authenticated' ? 'A' : null,
    error: null,
    refetch: vi.fn(),
  });
}

function renderPage(client?: QueryClient) {
  const queryClient =
    client ??
    new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>,
  );
  return queryClient;
}

afterEach(() => {
  cleanup();
  mockSessionState.mockReset();
  getCurrent.mockReset();
  mockNavigate.mockReset();
});

describe('DashboardPage', () => {
  it('shows a workspace loading state while the session is pending and sends no profile request', () => {
    setSession('pending');
    renderPage();
    expect(
      screen.getByRole('main', { name: 'Cargando panel' }),
    ).toBeInTheDocument();
    expect(getCurrent).not.toHaveBeenCalled();
  });

  it('continues to /login with /dashboard preserved when there is no session', async () => {
    setSession('unauthenticated');
    renderPage();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/login',
        search: { returnTo: '/dashboard' },
      }),
    );
    expect(getCurrent).not.toHaveBeenCalled();
  });

  it('shows a recoverable state when the session is unknown and sends no profile request', () => {
    setSession('unknown');
    renderPage();

    expect(
      screen.getByText(
        'No se pudo comprobar la sesión. Comprueba tu conexión e inténtalo de nuevo.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reintentar' }),
    ).toBeInTheDocument();
    expect(getCurrent).not.toHaveBeenCalled();
  });

  it('greets the user and shows a read-only summary without an email on 200', async () => {
    setSession('authenticated');
    getCurrent.mockResolvedValue(profile);
    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Hola, Ana García' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Calle 1')).toBeInTheDocument();
    expect(screen.getByText('600000000')).toBeInTheDocument();
    expect(screen.queryByText(/@/)).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('continues to /users with /dashboard preserved when the profile does not exist', async () => {
    setSession('authenticated');
    getCurrent.mockRejectedValue(new ApiError(404, 'Profile not found'));
    renderPage();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/users',
        search: { returnTo: '/dashboard' },
      }),
    );
  });

  it('clears private data and continues to /login when the session expires on the profile read', async () => {
    setSession('authenticated');
    getCurrent.mockRejectedValue(new ApiError(401, 'Invalid session'));
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(profileQueryKey('A'), profile);
    renderPage(client);

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/login',
        search: { returnTo: '/dashboard' },
      }),
    );
    expect(client.getQueryData(profileQueryKey('A'))).toBeUndefined();
  });

  it('shows a recoverable state when the profile fails without a definitive answer', async () => {
    setSession('authenticated');
    getCurrent.mockRejectedValue(new TypeError('Failed to fetch'));
    renderPage();

    expect(
      await screen.findByText(
        'No se pudo cargar el perfil. Inténtalo de nuevo.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Hola,/)).toBeNull();
  });
});
