import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/lib/api-client';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => navigateMock,
}));

vi.mock('../../auth/api/auth.api', () => ({
  authApi: { account: vi.fn(), changePassword: vi.fn() },
}));

import { authApi } from '../../auth/api/auth.api';
import { AccountSecuritySection } from './account-security';

const account = vi.mocked(authApi.account);
const changePassword = vi.mocked(authApi.changePassword);

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AccountSecuritySection />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  account.mockReset();
  changePassword.mockReset();
  navigateMock.mockReset();
});

describe('AccountSecuritySection', () => {
  it('shows a loading state while the account summary is pending', () => {
    account.mockReturnValue(new Promise(() => undefined));
    renderSection();

    expect(screen.getByText('Cargando…')).toBeInTheDocument();
  });

  it('shows the session email, last modification, and the change control', async () => {
    account.mockResolvedValue({
      email: 'ada@example.com',
      hasPassword: true,
      passwordUpdatedAt: '2026-01-02T03:04:05.000Z',
    });
    renderSection();

    expect(await screen.findByText('ada@example.com')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Cambiar contraseña' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it('shows the email but no password change entry point without a credential', async () => {
    account.mockResolvedValue({
      email: 'ada@example.com',
      hasPassword: false,
      passwordUpdatedAt: null,
    });
    renderSection();

    expect(await screen.findByText('ada@example.com')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Cambiar contraseña' }),
    ).toBeNull();
  });

  it('clears private data and offers /login when the session expired', async () => {
    account.mockRejectedValue(new ApiError(401, 'expired'));
    renderSection();

    await waitFor(() =>
      expect(
        screen.getByRole('link', { name: 'Iniciar sesión' }),
      ).toHaveAttribute('href', '/login'),
    );
    expect(screen.queryByText('ada@example.com')).toBeNull();
  });

  it('shows a recoverable inline state without inventing account data', async () => {
    account.mockRejectedValue(new TypeError('Failed to fetch'));
    renderSection();

    expect(
      await screen.findByText(
        'No se pudo cargar la información de la cuenta. Inténtalo de nuevo.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('ada@example.com')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Reintentar' }),
    ).toBeInTheDocument();
  });

  it('opens the change-password dialog from the change control', async () => {
    account.mockResolvedValue({
      email: 'ada@example.com',
      hasPassword: true,
      passwordUpdatedAt: '2026-01-02T03:04:05.000Z',
    });
    renderSection();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Cambiar contraseña' }),
    );

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(
      screen.getByText(
        'Introduce tu contraseña actual y la nueva para completar el cambio.',
      ),
    ).toBeInTheDocument();
  });

  it('shows a confirmation and stays signed in after a successful change', async () => {
    account.mockResolvedValue({
      email: 'ada@example.com',
      hasPassword: true,
      passwordUpdatedAt: '2026-01-02T03:04:05.000Z',
    });
    changePassword.mockResolvedValue({ status: 'ok' });
    renderSection();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Cambiar contraseña' }),
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Contraseña actual'), {
      target: { value: 'Current!Pass1' },
    });
    fireEvent.change(within(dialog).getByLabelText('Nueva contraseña'), {
      target: { value: 'N3w!Passphrase' },
    });
    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.submit(
      within(dialog)
        .getByRole('button', { name: 'Cambiar contraseña' })
        .closest('form') as HTMLFormElement,
    );

    expect(
      await screen.findByText('Contraseña actualizada.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
  });
});
