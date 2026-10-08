import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/lib/api-client';

vi.mock('../../users/api/users.api', () => ({
  usersApi: { create: vi.fn(), getCurrent: vi.fn() },
}));

vi.mock('../api/settings.api', () => ({
  settingsApi: { update: vi.fn() },
}));

import { usersApi } from '../../users/api/users.api';
import { settingsApi } from '../api/settings.api';
import { useCompleteProfile } from './use-complete-profile';

const create = vi.mocked(usersApi.create);
const getCurrent = vi.mocked(usersApi.getCurrent);
const update = vi.mocked(settingsApi.update);

const profile = {
  id: 1,
  authUserId: 'A',
  name: 'Ana',
  surname: 'García',
  address: 'Calle 1',
  phone: '600000000',
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => {
  create.mockReset();
  getCurrent.mockReset();
  update.mockReset();
});

describe('useCompleteProfile', () => {
  it('persists the language before creating the profile', async () => {
    update.mockResolvedValue({ language: 'ca' });
    create.mockResolvedValue(profile);

    const { result } = renderHook(() => useCompleteProfile('A'), { wrapper });
    result.current.mutate({
      name: 'Ana',
      surname: 'García',
      address: 'Calle 1',
      phone: '600000000',
      language: 'ca',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(update).toHaveBeenCalledWith({ language: 'ca' });
    expect(create).toHaveBeenCalledWith({
      name: 'Ana',
      surname: 'García',
      address: 'Calle 1',
      phone: '600000000',
    });
    expect(update.mock.invocationCallOrder[0]).toBeLessThan(
      create.mock.invocationCallOrder[0],
    );
  });

  it('treats a 409 conflict as already created and reads the existing profile', async () => {
    update.mockResolvedValue({ language: 'es' });
    create.mockRejectedValue(new ApiError(409, 'Profile already exists'));
    getCurrent.mockResolvedValue(profile);

    const { result } = renderHook(() => useCompleteProfile('A'), { wrapper });
    result.current.mutate({
      name: 'Ana',
      surname: 'García',
      address: 'Calle 1',
      phone: '600000000',
      language: 'es',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getCurrent).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(profile);
  });

  it('surfaces a non-conflict creation failure', async () => {
    update.mockResolvedValue({ language: 'es' });
    create.mockRejectedValue(new ApiError(400, 'Validation failed'));

    const { result } = renderHook(() => useCompleteProfile('A'), { wrapper });
    result.current.mutate({
      name: '',
      surname: '',
      address: '',
      phone: '',
      language: 'es',
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(getCurrent).not.toHaveBeenCalled();
  });
});
