import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/lib/api-client';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => navigateMock,
}));

vi.mock('../api/auth.api', () => ({
  authApi: { completeSignup: vi.fn() },
}));

import { authApi } from '../api/auth.api';
import CompleteSignupPage from './complete-signup-page';

const completeSignup = vi.mocked(authApi.completeSignup);

function renderAt(path: string) {
  window.history.replaceState({}, '', path);
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <CompleteSignupPage />
    </QueryClientProvider>,
  );
}

function submit(password = 'password123') {
  fireEvent.change(screen.getByLabelText('Contraseña'), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Activar cuenta' }));
}

afterEach(() => {
  cleanup();
  completeSignup.mockReset();
  navigateMock.mockReset();
  window.localStorage.clear();
});

describe('CompleteSignupPage', () => {
  it('activates, continues to /settings to complete the profile, and persists nothing', async () => {
    completeSignup.mockResolvedValue({
      userId: 'user-1',
      status: 'authenticated',
    });

    renderAt('/complete-signup?token=token-1');
    submit();

    await vi.waitFor(() => {
      expect(completeSignup).toHaveBeenCalledWith({
        token: 'token-1',
        password: 'password123',
      });
    });
    await vi.waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/settings',
        replace: true,
      });
    });
    expect(window.localStorage.length).toBe(0);
  });

  it('toggles password visibility without changing its value', () => {
    renderAt('/complete-signup?token=token-1');
    const passwordInput = screen.getByLabelText('Contraseña');

    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }));
    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(passwordInput).toHaveValue('password123');

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar' }));
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(passwordInput).toHaveValue('password123');
  });

  it('offers a restart when the token is missing', () => {
    renderAt('/complete-signup');

    expect(screen.getByText('Enlace no válido')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Iniciar registro' }),
    ).toHaveAttribute('href', '/signup');
  });

  it('offers a safe restart for an invalid or expired link', async () => {
    completeSignup.mockRejectedValue(new ApiError(400, 'invalid token', {}));

    renderAt('/complete-signup?token=expired');
    submit();

    expect(
      await screen.findByText(
        'El enlace no es válido o ha caducado. Inicia el registro de nuevo.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Iniciar registro de nuevo' }),
    ).toHaveAttribute('href', '/signup');
  });

  it('offers login when activation committed but the session failed', async () => {
    completeSignup.mockRejectedValue(
      new ApiError(429, 'rate limited', { accountActivated: true }),
    );

    renderAt('/complete-signup?token=token-1');
    submit();

    expect(await screen.findByText('Cuenta activada')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Iniciar sesión' }),
    ).toHaveAttribute('href', '/login');
  });

  it('shows a recoverable message when completion fails operationally', async () => {
    completeSignup.mockRejectedValue(new ApiError(503, 'unavailable', {}));

    renderAt('/complete-signup?token=token-1');
    submit();

    expect(
      await screen.findByText(
        'No se pudo completar el registro. Inténtalo de nuevo.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Cuenta activada')).toBeNull();
  });
});
