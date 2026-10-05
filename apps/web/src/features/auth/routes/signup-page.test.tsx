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
  authApi: { signup: vi.fn() },
}));

import { authApi } from '../api/auth.api';
import SignupPage from './signup-page';

const signup = vi.mocked(authApi.signup);

function renderPage() {
  const client = new QueryClient();
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
  fireEvent.change(screen.getByLabelText('Contraseña'), {
    target: { value: 'password123' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
}

afterEach(() => {
  cleanup();
  signup.mockReset();
});

describe('SignupPage', () => {
  it('shows a check-your-email confirmation on success and starts no session', async () => {
    signup.mockResolvedValue({
      userId: 'user-1',
      status: 'pending-verification',
    });
    renderPage();
    submit();

    expect(await screen.findByText('Revisa tu correo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Crear cuenta' })).toBeNull();
  });

  it('reports an already registered email on 409', async () => {
    signup.mockRejectedValue(new ApiError(409, 'Email exists'));
    renderPage();
    submit();
    expect(
      await screen.findByText('Este correo ya está registrado.'),
    ).toBeInTheDocument();
  });

  it('surfaces a network failure recoverably', async () => {
    signup.mockRejectedValue(new TypeError('Failed to fetch'));
    renderPage();
    submit();
    expect(
      await screen.findByText(
        'No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.',
      ),
    ).toBeInTheDocument();
  });
});
