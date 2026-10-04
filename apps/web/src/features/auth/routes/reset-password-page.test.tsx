import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

  it('shows the form when a token is present', () => {
    openAt('?token=abc');
    render(<ResetPasswordPage />);
    expect(
      screen.getByRole('heading', { name: 'Restablecer contraseña' }),
    ).toBeInTheDocument();
  });

  it('confirms after a successful submission', async () => {
    openAt('?token=abc');
    confirmPasswordReset.mockResolvedValue({ status: 'ok' });
    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByPlaceholderText('Nueva contraseña'), {
      target: { value: 'password123' },
    });
    submitForm();

    await waitFor(() =>
      expect(
        screen.getByText('Contraseña actualizada. Ya puedes iniciar sesión.'),
      ).toBeInTheDocument(),
    );
  });

  it('surfaces a failed submission inline', async () => {
    openAt('?token=abc');
    confirmPasswordReset.mockRejectedValue(new Error('bad token'));
    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByPlaceholderText('Nueva contraseña'), {
      target: { value: 'password123' },
    });
    submitForm();

    await waitFor(() =>
      expect(
        screen.getByText('El enlace no es válido o ha caducado.'),
      ).toBeInTheDocument(),
    );
  });
});
