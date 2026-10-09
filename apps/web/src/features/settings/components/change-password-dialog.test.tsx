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

vi.mock('../../auth/api/auth.api', () => ({
  authApi: { changePassword: vi.fn() },
}));

import { authApi } from '../../auth/api/auth.api';
import { ChangePasswordDialog } from './change-password-dialog';

const changePassword = vi.mocked(authApi.changePassword);

const NEW_PASSWORD = 'N3w!Passphrase';
const CURRENT_PASSWORD = 'Current!Pass1';

function renderDialog(
  handlers: {
    onOpenChange?: (open: boolean) => void;
    onChanged?: () => void;
  } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ChangePasswordDialog
        open
        onOpenChange={handlers.onOpenChange ?? (() => undefined)}
        onChanged={handlers.onChanged}
      />
    </QueryClientProvider>,
  );
}

function fillAndConsent({
  current = CURRENT_PASSWORD,
  next = NEW_PASSWORD,
}: { current?: string; next?: string } = {}) {
  fireEvent.change(screen.getByLabelText('Contraseña actual'), {
    target: { value: current },
  });
  fireEvent.change(screen.getByLabelText('Nueva contraseña'), {
    target: { value: next },
  });
  fireEvent.click(screen.getByRole('checkbox'));
}

function submit() {
  fireEvent.submit(
    screen
      .getByRole('button', { name: 'Cambiar contraseña' })
      .closest('form') as HTMLFormElement,
  );
}

afterEach(() => {
  cleanup();
  changePassword.mockReset();
});

describe('ChangePasswordDialog', () => {
  it('gates submission until current password, policy, and consent are ready', async () => {
    renderDialog();

    const submitButton = screen.getByRole('button', {
      name: 'Cambiar contraseña',
    });
    expect(submitButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Nueva contraseña'), {
      target: { value: NEW_PASSWORD },
    });
    expect(submitButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Contraseña actual'), {
      target: { value: CURRENT_PASSWORD },
    });
    expect(submitButton).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(submitButton).toBeEnabled();

    submit();
    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
      }),
    );
  });

  it('shows the consent statement in the active locale', () => {
    renderDialog();

    expect(
      screen.getByText(
        'Al cambiar la contraseña se cerrará la sesión en el resto de dispositivos. Este dispositivo seguirá conectado.',
      ),
    ).toBeInTheDocument();
  });

  it('shows an inline error at the current-password field and stays open', async () => {
    changePassword.mockRejectedValue(
      new ApiError(400, 'invalid', {
        details: [
          {
            field: 'currentPassword',
            code: 'invalid_format',
            message: 'current password is incorrect',
          },
        ],
      }),
    );
    renderDialog();
    fillAndConsent();
    submit();

    await waitFor(() =>
      expect(
        screen.getByText('La contraseña actual no es correcta.'),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.queryByRole('status', {
        name: /contraseña se ha cambiado/i,
      }),
    ).toBeNull();
  });

  it('marks the new-password field when the server rejects the policy', async () => {
    changePassword.mockRejectedValue(
      new ApiError(400, 'invalid', {
        details: [
          {
            field: 'newPassword',
            code: 'custom',
            message: 'Password must contain at least one digit',
          },
        ],
      }),
    );
    renderDialog();
    fillAndConsent();
    submit();

    await waitFor(() =>
      expect(
        screen.getByText('La nueva contraseña no cumple los requisitos.'),
      ).toBeInTheDocument(),
    );
    expect(screen.getByLabelText('Nueva contraseña')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('shows a waiting state on 429 without closing or claiming success', async () => {
    changePassword.mockRejectedValue(
      new ApiError(429, 'rate limited', { retryAfterSeconds: 30 }),
    );
    renderDialog();
    fillAndConsent();
    submit();

    await waitFor(() =>
      expect(
        screen.getByText(
          'Demasiados intentos. Espera 30 segundos antes de reintentarlo.',
        ),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows a recoverable message on a network failure and stays open', async () => {
    changePassword.mockRejectedValue(new TypeError('Failed to fetch'));
    renderDialog();
    fillAndConsent();
    submit();

    await waitFor(() =>
      expect(
        screen.getByText(
          'No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.',
        ),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes the dialog and reports the change on success', async () => {
    changePassword.mockResolvedValue({ status: 'ok' });
    const onOpenChange = vi.fn();
    const onChanged = vi.fn();
    renderDialog({ onOpenChange, onChanged });
    fillAndConsent();
    submit();

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('toggles field visibility without changing values', () => {
    renderDialog();

    const current = screen.getByLabelText('Contraseña actual');
    const next = screen.getByLabelText('Nueva contraseña');
    fireEvent.change(current, { target: { value: 'secret-one' } });
    fireEvent.change(next, { target: { value: 'secret-two' } });

    fireEvent.click(screen.getAllByRole('button', { name: 'Mostrar' })[0]);
    expect(current).toHaveAttribute('type', 'text');
    expect(next).toHaveAttribute('type', 'password');
    expect(current).toHaveValue('secret-one');
    expect(next).toHaveValue('secret-two');

    fireEvent.click(screen.getAllByRole('button', { name: 'Ocultar' })[0]);
    expect(current).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getAllByRole('button', { name: 'Mostrar' })[1]);
    expect(next).toHaveAttribute('type', 'text');
  });
});
