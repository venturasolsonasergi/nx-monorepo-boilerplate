import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

import VerifiedPage from './verified-page';

function openAt(search: string) {
  window.history.replaceState({}, '', `/verified${search}`);
}

afterEach(() => {
  cleanup();
});

describe('VerifiedPage', () => {
  it('confirms verification and continues to login without claiming a session', () => {
    openAt('?verified=true');
    render(<VerifiedPage />);
    expect(
      screen.getByText('Tu correo se ha verificado correctamente.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Iniciar sesión' }),
    ).toHaveAttribute('href', '/login');
  });

  it('shows the error value and continues to login', () => {
    openAt('?error=INVALID_TOKEN');
    render(<VerifiedPage />);
    expect(
      screen.getByText('No se pudo verificar el correo (INVALID_TOKEN).'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Iniciar sesión' }),
    ).toHaveAttribute('href', '/login');
  });
});
