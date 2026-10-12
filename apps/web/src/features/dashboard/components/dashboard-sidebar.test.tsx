import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    'aria-label': ariaLabel,
  }: {
    to: string;
    children: React.ReactNode;
    'aria-label'?: string;
    activeOptions?: unknown;
    activeProps?: unknown;
  }) => (
    <a href={to} aria-label={ariaLabel}>
      {children}
    </a>
  ),
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

function renderSidebar(open = true) {
  return render(
    <SidebarProvider open={open}>
      <DashboardSidebar />
    </SidebarProvider>,
  );
}

describe('DashboardSidebar', () => {
  it('links only to the dashboard navigation entry', () => {
    renderSidebar();

    expect(screen.getByRole('link', { name: 'Panel' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(screen.queryByRole('link', { name: 'Mi perfil' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Inicio' })).toBeNull();
    expect(screen.queryByText('Próximamente')).toBeNull();
  });

  it('shows the brand menu icon when collapsed, distinct from the dashboard icon', () => {
    const { container } = renderSidebar(false);

    const brand = screen.getByRole('link', { name: 'Ir al inicio' });
    expect(brand.querySelector('svg.lucide-menu')).not.toBeNull();
    expect(
      container.querySelector('svg.lucide-layout-dashboard'),
    ).not.toBeNull();
  });
});
