import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { profileQueryKey } from '../../../shared/lib/query-keys';

vi.mock('../api/users.api', () => ({
  usersApi: { getCurrent: vi.fn(), create: vi.fn(), update: vi.fn() },
}));

import { usersApi } from '../api/users.api';
import { useUpdateProfile } from './use-update-profile';

const update = vi.mocked(usersApi.update);

const UPDATED_PROFILE = {
  id: 1,
  authUserId: 'auth-user-1',
  name: 'Grace',
  surname: 'Hopper',
  address: '9 Harbor Road',
  phone: '555-0199',
};

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
  update.mockReset();
});

describe('useUpdateProfile', () => {
  it('submits the edited fields to PATCH /users/me', async () => {
    update.mockResolvedValue(UPDATED_PROFILE);
    const client = makeClient();

    const { result } = renderHook(() => useUpdateProfile('auth-user-1'), {
      wrapper: wrapperFor(client),
    });
    result.current.mutate({
      name: 'Grace',
      surname: 'Hopper',
      address: '9 Harbor Road',
      phone: '555-0199',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(update).toHaveBeenCalledWith({
      name: 'Grace',
      surname: 'Hopper',
      address: '9 Harbor Road',
      phone: '555-0199',
    });
  });

  it('writes the validated response into the profile cache on success', async () => {
    update.mockResolvedValue(UPDATED_PROFILE);
    const client = makeClient();

    const { result } = renderHook(() => useUpdateProfile('auth-user-1'), {
      wrapper: wrapperFor(client),
    });
    result.current.mutate({
      name: 'Grace',
      surname: 'Hopper',
      address: '9 Harbor Road',
      phone: '555-0199',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData(profileQueryKey('auth-user-1'))).toEqual(
      UPDATED_PROFILE,
    );
  });

  it('leaves the cache untouched on failure', async () => {
    update.mockRejectedValue(new Error('400'));
    const client = makeClient();

    const { result } = renderHook(() => useUpdateProfile('auth-user-1'), {
      wrapper: wrapperFor(client),
    });
    result.current.mutate({
      name: 'Grace',
      surname: 'Hopper',
      address: '9 Harbor Road',
      phone: '555-0199',
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData(profileQueryKey('auth-user-1'))).toBeUndefined();
  });
});
