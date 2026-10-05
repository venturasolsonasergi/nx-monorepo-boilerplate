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

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('../../auth', () => ({ useSessionState: vi.fn() }));

vi.mock('../api/users.api', () => ({
  usersApi: { getCurrent: vi.fn(), create: vi.fn() },
}));

import { useSessionState } from '../../auth';
import type { SessionStatus } from '../../auth';
import { usersApi } from '../api/users.api';
import UsersPage from './users-page';

const mockSessionState = vi.mocked(useSessionState);
const getCurrent = vi.mocked(usersApi.getCurrent);
const create = vi.mocked(usersApi.create);

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

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <UsersPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  mockSessionState.mockReset();
  getCurrent.mockReset();
  create.mockReset();
});

describe('UsersPage', () => {
  it('asks the visitor to sign in when there is no session and sends no request', () => {
    setSession('unauthenticated');
    renderPage();
    expect(
      screen.getByRole('link', { name: 'Iniciar sesión' }),
    ).toHaveAttribute('href', '/login');
    expect(getCurrent).not.toHaveBeenCalled();
  });

  it('shows a recoverable state when the session is unknown', () => {
    setSession('unknown');
    renderPage();
    expect(
      screen.getByText(
        'No se pudo comprobar la sesión. Comprueba tu conexión e inténtalo de nuevo.',
      ),
    ).toBeInTheDocument();
    expect(getCurrent).not.toHaveBeenCalled();
  });

  it('displays the existing profile without a form', async () => {
    setSession('authenticated');
    getCurrent.mockResolvedValue(profile);
    renderPage();

    expect(await screen.findByText('Mi perfil')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('García')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Crear perfil' })).toBeNull();
  });

  it('renders the creation form when the profile does not exist', async () => {
    setSession('authenticated');
    getCurrent.mockRejectedValue(new ApiError(404, 'Profile not found'));
    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Crear perfil' }),
    ).toBeInTheDocument();
  });

  it('never shows the form when the session expires on the profile read', async () => {
    setSession('authenticated');
    getCurrent.mockRejectedValue(new ApiError(401, 'Invalid session'));
    renderPage();

    expect(
      await screen.findByText(
        'Tu sesión ha caducado. Vuelve a iniciar sesión.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Crear perfil' })).toBeNull();
  });

  it('does not present a retrieval failure as a missing profile', async () => {
    setSession('authenticated');
    getCurrent.mockRejectedValue(new TypeError('Failed to fetch'));
    renderPage();

    expect(
      await screen.findByText(
        'No se pudo cargar el perfil. Inténtalo de nuevo.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Crear perfil' })).toBeNull();
  });

  it('shows the profile after a successful creation', async () => {
    setSession('authenticated');
    getCurrent.mockRejectedValue(new ApiError(404, 'Profile not found'));
    create.mockResolvedValue(profile);
    renderPage();

    await screen.findByRole('heading', { name: 'Crear perfil' });
    fireEvent.change(screen.getByPlaceholderText('Nombre'), {
      target: { value: 'Ana' },
    });
    fireEvent.change(screen.getByPlaceholderText('Apellidos'), {
      target: { value: 'García' },
    });
    fireEvent.change(screen.getByPlaceholderText('Dirección'), {
      target: { value: 'Calle 1' },
    });
    fireEvent.change(screen.getByPlaceholderText('Teléfono'), {
      target: { value: '600000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear perfil' }));

    await waitFor(() =>
      expect(screen.getByText('Mi perfil')).toBeInTheDocument(),
    );
    expect(screen.queryByRole('heading', { name: 'Crear perfil' })).toBeNull();
  });
});
