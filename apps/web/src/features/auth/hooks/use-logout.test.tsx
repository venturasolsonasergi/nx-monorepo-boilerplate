import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/lib/api-client';
import { clearPrivateCaches } from '../../../shared/lib/private-cache';
import {
  profileQueryKey,
  sessionQueryKey,
} from '../../../shared/lib/query-keys';

vi.mock('../api/auth.api', () => ({
  authApi: { logout: vi.fn(), getSession: vi.fn() },
}));

import { authApi } from '../api/auth.api';
import { useLogout } from './use-logout';
import { useSessionState } from './use-session';

const logout = vi.mocked(authApi.logout);
const getSession = vi.mocked(authApi.getSession);

const profileA = {
  id: 1,
  authUserId: 'A',
  name: 'Ana',
  surname: 'García',
  address: 'Calle 1',
  phone: '600000000',
};

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function wrapperFor(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function SessionBadge() {
  const { state } = useSessionState();
  return <span>{state}</span>;
}

afterEach(() => {
  cleanup();
  logout.mockReset();
  getSession.mockReset();
});

describe('logout and private cache', () => {
  it('clears the session and profile caches on logout', async () => {
    logout.mockResolvedValue({ status: 'ok' });
    const client = makeClient();
    client.setQueryData(sessionQueryKey, {
      userId: 'A',
      status: 'authenticated',
    });
    client.setQueryData(profileQueryKey('A'), profileA);

    const { result } = renderHook(() => useLogout(), {
      wrapper: wrapperFor(client),
    });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData(sessionQueryKey)).toBeFalsy();
    expect(client.getQueryData(profileQueryKey('A'))).toBeUndefined();
  });

  it('updates active observers to the anonymous state after logout', async () => {
    getSession.mockResolvedValue({ userId: 'A', status: 'authenticated' });
    logout.mockResolvedValue({ status: 'ok' });
    const client = makeClient();

    const { result } = renderHook(() => useLogout(), {
      wrapper: wrapperFor(client),
    });
    render(
      <QueryClientProvider client={client}>
        <SessionBadge />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText('authenticated')).toBeInTheDocument(),
    );

    getSession.mockRejectedValue(new ApiError(401, 'Invalid session'));
    result.current.mutate();

    await waitFor(() =>
      expect(screen.getByText('unauthenticated')).toBeInTheDocument(),
    );
  });

  it('does not let a later user inherit the previous profile data', async () => {
    const client = makeClient();
    client.setQueryData(sessionQueryKey, {
      userId: 'A',
      status: 'authenticated',
    });
    client.setQueryData(profileQueryKey('A'), profileA);

    await clearPrivateCaches(client);
    client.setQueryData(sessionQueryKey, {
      userId: 'B',
      status: 'authenticated',
    });

    expect(client.getQueryData(profileQueryKey('A'))).toBeUndefined();
    expect(client.getQueryData(profileQueryKey('B'))).toBeUndefined();
  });
});
