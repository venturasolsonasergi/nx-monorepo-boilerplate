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

vi.mock('../../auth/api/auth.api', () => ({
  authApi: { getSession: vi.fn(), logout: vi.fn() },
}));

vi.mock('../../users/api/users.api', () => ({
  usersApi: { getCurrent: vi.fn() },
}));

vi.mock('../../../shared/lib/use-mobile', () => ({
  useIsMobile: () => false,
}));

import { authApi } from '../../auth/api/auth.api';
import { usersApi } from '../../users/api/users.api';
import { SidebarProvider } from '../../../shared/ui/sidebar';
import { AccountFooter } from './account-footer';

const getSession = vi.mocked(authApi.getSession);
const logout = vi.mocked(authApi.logout);
const getCurrent = vi.mocked(usersApi.getCurrent);

const profileA = {
  id: 1,
  authUserId: 'A',
  name: 'Ana',
  surname: 'García',
  address: 'Calle 1',
  phone: '600000000',
};
const profileB = {
  id: 2,
  authUserId: 'B',
  name: 'Beto',
  surname: 'López',
  address: 'Calle 2',
  phone: '600000001',
};

function renderFooter(client: QueryClient) {
  render(
    <QueryClientProvider client={client}>
      <SidebarProvider>
        <AccountFooter />
      </SidebarProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  getSession.mockReset();
  logout.mockReset();
  getCurrent.mockReset();
  mockNavigate.mockReset();
});

describe('AccountFooter', () => {
  it('logs out, clears the previous user, and continues to the landing', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    getSession.mockResolvedValue({ userId: 'A', status: 'authenticated' });
    getCurrent.mockResolvedValue(profileA);
    logout.mockImplementation(() => {
      // After a successful logout the session cookie is gone.
      getSession.mockRejectedValue(new ApiError(401, 'Invalid session'));
      return Promise.resolve({ status: 'ok' });
    });

    renderFooter(client);
    expect(await screen.findByText('Ana García')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: '/' }));
    expect(client.getQueryData(sessionQueryKey)).toBeFalsy();
    expect(screen.queryByText('Ana García')).toBeNull();

    // A later user (B) never inherits A's data.
    getCurrent.mockResolvedValue(profileB);
    client.setQueryData(sessionQueryKey, {
      userId: 'B',
      status: 'authenticated',
    });

    expect(await screen.findByText('Beto López')).toBeInTheDocument();
    expect(screen.queryByText('Ana García')).toBeNull();
    expect(screen.queryByText('Calle 1')).toBeNull();
  });
});
