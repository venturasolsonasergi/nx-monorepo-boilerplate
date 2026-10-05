import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

import LandingPage from './landing-page';

afterEach(cleanup);

describe('LandingPage', () => {
  it('shows the project name, a factual purpose, and both entry actions', () => {
    render(<LandingPage />);

    expect(
      screen.getByRole('heading', { name: 'nx-monorepo-boilerplate' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/desarrollo guiado por especificaciones/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Acceder' })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute(
      'href',
      '/signup',
    );
  });

  it('names the real code organization, runtime and layers', () => {
    render(<LandingPage />);

    expect(screen.getAllByText('apps/web').length).toBeGreaterThan(0);
    expect(screen.getAllByText('apps/api').length).toBeGreaterThan(0);
    expect(screen.getByText('auth · users · orders')).toBeInTheDocument();
    expect(screen.getByText('libs/auth')).toBeInTheDocument();
    expect(screen.getByText('libs/users')).toBeInTheDocument();
    expect(screen.getByText('libs/orders')).toBeInTheDocument();
    expect(
      screen.getByText('infrastructure → application → domain'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no se despliegan como servicios independientes/),
    ).toBeInTheDocument();
  });

  it('adds no decorative illustrations', () => {
    render(<LandingPage />);
    expect(document.querySelectorAll('img')).toHaveLength(0);
  });
});
