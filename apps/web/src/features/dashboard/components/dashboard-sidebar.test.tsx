import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
  }: {
    to: string;
    children: React.ReactNode;
    activeOptions?: unknown;
    activeProps?: unknown;
  }) => <a href={to}>{children}</a>,
}));

vi.mock('../../../shared/lib/use-mobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('./account-footer', () => ({
  AccountFooter: () => <div data-testid="account-footer" />,
}));

import { SidebarProvider } from '../../../shared/ui/sidebar';
import { DashboardSidebar } from './dashboard-sidebar';

afterEach(cleanup);

describe('DashboardSidebar', () => {
  it('links only to the implemented destinations', () => {
    render(
      <SidebarProvider>
        <DashboardSidebar />
      </SidebarProvider>,
    );

    expect(screen.getByRole('link', { name: /Panel/ })).toHaveAttribute(
      'href',
      '/dashboard',
    );
    expect(screen.getByRole('link', { name: /Mi perfil/ })).toHaveAttribute(
      'href',
      '/settings',
    );
    expect(screen.getByRole('link', { name: /Inicio/ })).toHaveAttribute(
      'href',
      '/',
    );
    expect(screen.queryByText('Próximamente')).toBeNull();
  });
});
