import { useState } from 'react';
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
import { profileQueryKey } from '../../../shared/lib/query-keys';

vi.mock('../../users/api/users.api', () => ({
  usersApi: { getCurrent: vi.fn(), create: vi.fn(), update: vi.fn() },
}));

import { usersApi } from '../../users/api/users.api';
import { useProfile } from '../../users/hooks/use-profile';
import { ProfileView } from '../../users/components/profile-view';
import { EditProfile } from './settings-page';

const update = vi.mocked(usersApi.update);
const getCurrent = vi.mocked(usersApi.getCurrent);

const profile = {
  id: 1,
  authUserId: 'auth-user-1',
  name: 'Ada',
  surname: 'Lovelace',
  address: '1 Main Street',
  phone: '555-0100',
};

// Mirrors the settings page's profile section: a read-only view with an edit
// control that swaps it for the pre-filled form.
function EditFlowHarness() {
  const { data } = useProfile('auth-user-1');
  const [editing, setEditing] = useState(false);

  if (!data) {
    return null;
  }

  return editing ? (
    <EditProfile profile={data} onDone={() => setEditing(false)} />
  ) : (
    <ProfileView profile={data} onEdit={() => setEditing(true)} />
  );
}

function renderHarness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(profileQueryKey('auth-user-1'), profile);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  render(
    <Wrapper>
      <EditFlowHarness />
    </Wrapper>,
  );
  return client;
}

afterEach(() => {
  cleanup();
  update.mockReset();
  getCurrent.mockReset();
});

describe('profile edit flow', () => {
  it('opens a pre-filled form from the edit control', () => {
    renderHarness();

    fireEvent.click(screen.getByRole('button', { name: 'Editar perfil' }));

    expect(screen.getByLabelText('Nombre')).toHaveValue('Ada');
    expect(screen.getByLabelText('Apellidos')).toHaveValue('Lovelace');
    expect(screen.getByLabelText('Dirección')).toHaveValue('1 Main Street');
    expect(screen.getByLabelText('Teléfono')).toHaveValue('555-0100');
  });

  it('submits the edited values and shows the updated values on success', async () => {
    getCurrent.mockResolvedValue(profile);
    const updated = { ...profile, name: 'Grace', address: '9 Harbor Road' };
    update.mockResolvedValue(updated);
    renderHarness();

    fireEvent.click(screen.getByRole('button', { name: 'Editar perfil' }));
    fireEvent.change(screen.getByLabelText('Nombre'), {
      target: { value: 'Grace' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({
        name: 'Grace',
        surname: 'Lovelace',
        address: '1 Main Street',
        phone: '555-0100',
      }),
    );
    await waitFor(() => expect(screen.getByText('Grace')).toBeInTheDocument());
    expect(screen.getByText('9 Harbor Road')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Guardar cambios' }),
    ).toBeNull();
  });

  it('cancels without any request', () => {
    renderHarness();

    fireEvent.click(screen.getByRole('button', { name: 'Editar perfil' }));
    fireEvent.change(screen.getByLabelText('Nombre'), {
      target: { value: 'Changed' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(update).not.toHaveBeenCalled();
    expect(screen.getByText('Ada')).toBeInTheDocument();
  });

  it('shows inline field errors on a 400 and keeps the form open', async () => {
    update.mockRejectedValue(
      new ApiError(400, 'Validation failed', {
        details: [
          { field: 'name', code: 'too_small', message: 'name cannot be empty' },
        ],
      }),
    );
    renderHarness();

    fireEvent.click(screen.getByRole('button', { name: 'Editar perfil' }));
    fireEvent.change(screen.getByLabelText('Nombre'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(
      await screen.findByText('Revisa el campo Nombre.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Guardar cambios' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toHaveValue('   ');
  });

  it('shows a recoverable message on other failures without closing', async () => {
    update.mockRejectedValue(new TypeError('Failed to fetch'));
    renderHarness();

    fireEvent.click(screen.getByRole('button', { name: 'Editar perfil' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(
      await screen.findByText(
        'No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Guardar cambios' }),
    ).toBeInTheDocument();
  });
});
