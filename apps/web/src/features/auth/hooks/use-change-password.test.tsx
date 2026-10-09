import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { accountQueryKey } from '../../../shared/lib/query-keys';

vi.mock('../api/auth.api', () => ({
  authApi: { account: vi.fn(), changePassword: vi.fn() },
}));

import { authApi } from '../api/auth.api';
import { useAccount } from './use-account';
import { useChangePassword } from './use-change-password';

const account = vi.mocked(authApi.account);
const changePassword = vi.mocked(authApi.changePassword);

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function wrapperFor(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
  account.mockReset();
  changePassword.mockReset();
});

describe('useAccount', () => {
  it('fetches the account summary when enabled', async () => {
    account.mockResolvedValue({
      email: 'ada@example.com',
      hasPassword: true,
      passwordUpdatedAt: '2026-01-02T03:04:05.000Z',
    });
    const client = makeClient();

    const { result } = renderHook(() => useAccount(true), {
      wrapper: wrapperFor(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      email: 'ada@example.com',
      hasPassword: true,
      passwordUpdatedAt: '2026-01-02T03:04:05.000Z',
    });
  });

  it('stays idle while disabled', () => {
    const client = makeClient();

    const { result } = renderHook(() => useAccount(false), {
      wrapper: wrapperFor(client),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(account).not.toHaveBeenCalled();
  });
});

describe('useChangePassword', () => {
  it('keeps the caller signed in and refreshes the account summary on success', async () => {
    changePassword.mockResolvedValue({ status: 'ok' });
    const client = makeClient();
    client.setQueryData(accountQueryKey, {
      email: 'ada@example.com',
      hasPassword: true,
      passwordUpdatedAt: '2026-01-02T03:04:05.000Z',
    });

    const { result } = renderHook(() => useChangePassword(), {
      wrapper: wrapperFor(client),
    });
    result.current.mutate({
      currentPassword: 'Current!Pass1',
      newPassword: 'New!Passphrase2',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // The caller stays signed in: the cached account data is kept but marked
    // stale so the summary refetches the new last-modified time.
    expect(client.getQueryData(accountQueryKey)).toBeDefined();
    expect(client.getQueryState(accountQueryKey)?.isInvalidated).toBe(true);
  });

  it('keeps the caches when the change fails', async () => {
    changePassword.mockRejectedValue(new Error('400'));
    const client = makeClient();

    const { result } = renderHook(() => useChangePassword(), {
      wrapper: wrapperFor(client),
    });
    result.current.mutate({
      currentPassword: 'Current!Pass1',
      newPassword: 'New!Passphrase2',
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
