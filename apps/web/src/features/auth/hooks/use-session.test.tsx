import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/lib/api-client';

vi.mock('../api/auth.api', () => ({
  authApi: { getSession: vi.fn() },
}));

import { authApi } from '../api/auth.api';
import { useSessionState } from './use-session';

const getSession = vi.mocked(authApi.getSession);

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => {
  getSession.mockReset();
});

describe('useSessionState', () => {
  it('reports authenticated on a 200 session response', async () => {
    getSession.mockResolvedValue({ userId: 'user-1', status: 'authenticated' });
    const { result } = renderHook(() => useSessionState(), { wrapper });

    await waitFor(() => expect(result.current.state).toBe('authenticated'));
    expect(result.current.userId).toBe('user-1');
  });

  it('reports unauthenticated on a 401', async () => {
    getSession.mockRejectedValue(new ApiError(401, 'Invalid session'));
    const { result } = renderHook(() => useSessionState(), { wrapper });

    await waitFor(() => expect(result.current.state).toBe('unauthenticated'));
    expect(result.current.userId).toBeNull();
  });

  it('reports unknown on a network failure', async () => {
    getSession.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useSessionState(), { wrapper });

    await waitFor(() => expect(result.current.state).toBe('unknown'));
  });
});
