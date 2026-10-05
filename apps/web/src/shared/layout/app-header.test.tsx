import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('../ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div role="menu">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    asChild,
    disabled,
  }: {
    children: ReactNode;
    asChild?: boolean;
    disabled?: boolean;
  }) =>
    asChild ? (
      <>{children}</>
    ) : (
      <div
        role="menuitem"
        aria-disabled={disabled ? true : undefined}
        data-disabled={disabled ? '' : undefined}
      >
        {children}
      </div>
    ),
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

vi.mock('../../features/auth/hooks/use-session', () => ({
  useSessionState: vi.fn(),
}));

vi.mock('../../features/auth/hooks/use-logout', () => ({
  useLogout: vi.fn(),
}));

import { useLogout } from '../../features/auth/hooks/use-logout';
import { useSessionState } from '../../features/auth/hooks/use-session';
import type { SessionStatus } from '../../features/auth/hooks/use-session';
import { AppHeader } from './app-header';

const mockSessionState = vi.mocked(useSessionState);
const mockLogout = vi.mocked(useLogout);

function withState(state: SessionStatus['state']) {
  mockSessionState.mockReturnValue({
    state,
    userId: state === 'authenticated' ? 'user-1' : null,
    error: null,
    refetch: vi.fn(),
  });
}

function withLogout(
  overrides: { isPending?: boolean; isError?: boolean } = {},
) {
  mockLogout.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    ...overrides,
  } as unknown as ReturnType<typeof useLogout>);
}

beforeEach(() => {
  withLogout();
});

afterEach(() => {
  cleanup();
  mockSessionState.mockReset();
  mockLogout.mockReset();
});

describe('AppHeader', () => {
  it('renders the wordmark and a loading control while the session is pending', () => {
    withState('pending');
    render(<AppHeader />);
    expect(
      screen.getByRole('link', { name: 'nx-monorepo-boilerplate' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Comprobando sesión' }),
    ).toBeDisabled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('offers "Acceder" linking to /login when unauthenticated', () => {
    withState('unauthenticated');
    render(<AppHeader />);
    expect(screen.getByRole('link', { name: 'Acceder' })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('shows profile, a disabled Dashboard and logout when authenticated', () => {
    withState('authenticated');
    render(<AppHeader />);

    expect(screen.getByRole('link', { name: 'Mi perfil' })).toHaveAttribute(
      'href',
      '/users',
    );

    const dashboard = screen.getByText('Dashboard');
    expect(dashboard.closest('a')).toBeNull();
    expect(dashboard.closest('[role="menuitem"]')).toHaveAttribute(
      'data-disabled',
    );

    expect(
      screen.getByRole('menuitem', { name: 'Cerrar sesión' }),
    ).toBeInTheDocument();
  });

  it('shows a recoverable non-signed-out state when the session is unknown', () => {
    withState('unknown');
    render(<AppHeader />);

    expect(
      screen.getByText('No se pudo comprobar la sesión'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'Reintentar' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Acceder' })).toBeNull();
  });

  it('shows a recoverable message when logout fails and stays signed in', () => {
    withState('authenticated');
    withLogout({ isError: true });
    render(<AppHeader />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se pudo cerrar la sesión.',
    );
    expect(screen.getByRole('link', { name: 'Mi perfil' })).toBeInTheDocument();
  });
});
