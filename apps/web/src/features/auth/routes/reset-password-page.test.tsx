import type { ReactNode } from 'react';
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

vi.mock('../api/auth.api', () => ({
  authApi: { confirmPasswordReset: vi.fn() },
}));

import { authApi } from '../api/auth.api';
import ResetPasswordPage from './reset-password-page';

const confirmPasswordReset = vi.mocked(authApi.confirmPasswordReset);

function openAt(search: string) {
  window.history.replaceState({}, '', `/reset-password${search}`);
}

function submitForm() {
  const form = screen
    .getByRole('button', { name: 'Cambiar contraseña' })
    .closest('form');
  fireEvent.submit(form as HTMLFormElement);
}

afterEach(() => {
  cleanup();
  confirmPasswordReset.mockReset();
});

describe('ResetPasswordPage', () => {
  it('shows the missing-token message when no token is present', () => {
    openAt('');
    render(<ResetPasswordPage />);
    expect(
      screen.getByText('Falta el token de restablecimiento.'),
    ).toBeInTheDocument();
  });

  it('shows an accessibly labelled form when a token is present', () => {
    openAt('?token=abc');
    render(<ResetPasswordPage />);
    expect(
      screen.getByRole('heading', { name: 'Restablecer contraseña' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nueva contraseña')).toBeInTheDocument();
  });

  it('confirms with a login link after a successful submission', async () => {
    openAt('?token=abc');
    confirmPasswordReset.mockResolvedValue({ status: 'ok' });
    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText('Nueva contraseña'), {
      target: { value: 'password123' },
    });
    submitForm();

    await waitFor(() =>
      expect(
        screen.getByText('Contraseña actualizada. Ya puedes iniciar sesión.'),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole('link', { name: 'Iniciar sesión' }),
    ).toHaveAttribute('href', '/login');
  });

  it('surfaces an invalid token inline', async () => {
    openAt('?token=abc');
    confirmPasswordReset.mockRejectedValue(new ApiError(400, 'bad token'));
    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText('Nueva contraseña'), {
      target: { value: 'password123' },
    });
    submitForm();

    await waitFor(() =>
      expect(
        screen.getByText('El enlace no es válido o ha caducado.'),
      ).toBeInTheDocument(),
    );
  });

  it('does not present a network failure as an invalid link', async () => {
    openAt('?token=abc');
    confirmPasswordReset.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText('Nueva contraseña'), {
      target: { value: 'password123' },
    });
    submitForm();

    await waitFor(() =>
      expect(
        screen.getByText(
          'No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.',
        ),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByText('El enlace no es válido o ha caducado.'),
    ).toBeNull();
  });
});
