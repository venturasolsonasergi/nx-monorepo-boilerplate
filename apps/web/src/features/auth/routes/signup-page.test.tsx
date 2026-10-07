import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/lib/api-client';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('../api/auth.api', () => ({
  authApi: {
    signup: vi.fn(),
    resendVerification: vi.fn(),
    getPublicConfig: vi.fn(),
  },
}));

import { authApi } from '../api/auth.api';
import SignupPage from './signup-page';

const signup = vi.mocked(authApi.signup);
const resend = vi.mocked(authApi.resendVerification);
const getPublicConfig = vi.mocked(authApi.getPublicConfig);

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SignupPage />
    </QueryClientProvider>,
  );
}

function submit() {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), {
    target: { value: 'ana@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
}

afterEach(() => {
  cleanup();
  signup.mockReset();
  resend.mockReset();
  getPublicConfig.mockReset();
});

describe('SignupPage', () => {
  it('shows the pending state with the original deadline and support on success', async () => {
    getPublicConfig.mockResolvedValue({ supportEmail: 'help@example.com' });
    signup.mockResolvedValue({
      status: 'pending-verification',
      expiresAt: '2030-01-03T00:00:00.000Z',
      emailStatus: 'accepted',
    });

    renderPage();
    submit();

    expect(await screen.findByText('Revisa tu correo')).toBeInTheDocument();
    expect(screen.getByText(/El enlace caduca el/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /soporte/i })).toHaveAttribute(
      'href',
      'mailto:help@example.com',
    );
    expect(
      screen.getByRole('button', { name: 'Reenviar enlace' }),
    ).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Crear cuenta' })).toBeNull();
  });

  it('reports a delivery failure without claiming success', async () => {
    getPublicConfig.mockResolvedValue({ supportEmail: null });
    signup.mockResolvedValue({
      status: 'pending-verification',
      expiresAt: '2030-01-03T00:00:00.000Z',
      emailStatus: 'failed',
    });

    renderPage();
    submit();

    expect(
      await screen.findByText(/No se pudo enviar el correo de activación/),
    ).toBeInTheDocument();
  });

  it('shows a waiting state and disables resend when throttled', async () => {
    getPublicConfig.mockResolvedValue({ supportEmail: null });
    signup.mockResolvedValue({
      status: 'pending-verification',
      expiresAt: '2030-01-03T00:00:00.000Z',
      emailStatus: 'throttled',
      retryAfterSeconds: 60,
    });

    renderPage();
    submit();

    expect(
      await screen.findByText(/demasiados envíos recientes/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reenviar enlace' }),
    ).toBeDisabled();
  });

  it('surfaces a recoverable message and keeps the form on source block', async () => {
    getPublicConfig.mockResolvedValue({ supportEmail: null });
    signup.mockRejectedValue(new ApiError(429, 'rate limited', {}));

    renderPage();
    submit();

    expect(
      await screen.findByText(
        'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Crear cuenta' }),
    ).toBeInTheDocument();
  });

  it('does not fabricate a support contact when config fails', async () => {
    getPublicConfig.mockRejectedValue(new ApiError(500, 'boom'));
    signup.mockResolvedValue({
      status: 'pending-verification',
      expiresAt: '2030-01-03T00:00:00.000Z',
      emailStatus: 'accepted',
    });

    renderPage();
    submit();

    expect(await screen.findByText('Revisa tu correo')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /soporte/i })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Reenviar enlace' }),
    ).toBeEnabled();
  });

  it('offers a restart once the deadline has passed', async () => {
    getPublicConfig.mockResolvedValue({ supportEmail: null });
    signup.mockResolvedValue({
      status: 'pending-verification',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      emailStatus: 'accepted',
    });

    renderPage();
    submit();

    expect(
      await screen.findByText(/El plazo de activación de 48 horas ha caducado/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Iniciar registro de nuevo' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Reenviar enlace' }),
    ).toBeNull();
  });

  it('shows an already-registered message on 409', async () => {
    getPublicConfig.mockResolvedValue({ supportEmail: null });
    signup.mockRejectedValue(new ApiError(409, 'exists', {}));

    renderPage();
    submit();

    expect(
      await screen.findByText('Este correo ya está registrado.'),
    ).toBeInTheDocument();
  });

  it('keeps the original deadline when the pending address is registered again', async () => {
    getPublicConfig.mockResolvedValue({ supportEmail: null });
    const expiresAt = '2030-05-01T12:00:00.000Z';
    signup.mockResolvedValue({
      status: 'pending-verification',
      expiresAt,
      emailStatus: 'accepted',
    });
    const expected = `El enlace caduca el ${new Date(
      expiresAt,
    ).toLocaleString()}.`;

    renderPage();
    submit();
    expect(await screen.findByText(expected)).toBeInTheDocument();

    // Registering the same pending address again yields the same pending state
    // and the same original deadline.
    cleanup();
    renderPage();
    submit();
    expect(await screen.findByText(expected)).toBeInTheDocument();
  });
});
