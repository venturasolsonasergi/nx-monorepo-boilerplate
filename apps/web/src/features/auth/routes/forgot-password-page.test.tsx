import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('../api/auth.api', () => ({
  authApi: { requestPasswordReset: vi.fn() },
}));

import { authApi } from '../api/auth.api';
import ForgotPasswordPage from './forgot-password-page';

const requestPasswordReset = vi.mocked(authApi.requestPasswordReset);

function renderPage() {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <ForgotPasswordPage />
    </QueryClientProvider>,
  );
}

function submit() {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), {
    target: { value: 'ana@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));
}

afterEach(() => {
  cleanup();
  requestPasswordReset.mockReset();
});

describe('ForgotPasswordPage', () => {
  it('shows a uniform non-disclosing confirmation on success', async () => {
    requestPasswordReset.mockResolvedValue({
      status: 'accepted',
      message: 'ok',
    });
    renderPage();
    submit();

    expect(
      await screen.findByText(
        'Si el correo corresponde a una cuenta, recibirás un enlace para restablecer tu contraseña.',
      ),
    ).toBeInTheDocument();
  });

  it('surfaces a network failure recoverably', async () => {
    requestPasswordReset.mockRejectedValue(new TypeError('Failed to fetch'));
    renderPage();
    submit();

    expect(
      await screen.findByText(
        'No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.',
      ),
    ).toBeInTheDocument();
  });
});
