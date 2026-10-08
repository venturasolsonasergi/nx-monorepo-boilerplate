import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/use-mobile', () => ({ useIsMobile: vi.fn() }));

import { useIsMobile } from '../lib/use-mobile';
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from './sidebar';

const mockIsMobile = vi.mocked(useIsMobile);

function renderSidebar() {
  return render(
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton aria-label="Inicio">Inicio</SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <div>
        <SidebarTrigger />
      </div>
    </SidebarProvider>,
  );
}

afterEach(() => {
  cleanup();
  mockIsMobile.mockReset();
});

describe('Sidebar', () => {
  it('collapses and expands the desktop sidebar from the trigger', async () => {
    mockIsMobile.mockReturnValue(false);
    renderSidebar();

    const sidebar = document.querySelector('[data-slot="sidebar"]');
    expect(sidebar).toHaveAttribute('data-state', 'expanded');

    fireEvent.click(
      screen.getByRole('button', { name: 'Alternar menú lateral' }),
    );

    await waitFor(() =>
      expect(sidebar).toHaveAttribute('data-state', 'collapsed'),
    );
  });

  it('opens an accessible sheet on mobile and closes it on Escape', async () => {
    mockIsMobile.mockReturnValue(true);
    renderSidebar();

    const trigger = screen.getByRole('button', {
      name: 'Alternar menú lateral',
    });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Menú de navegación' }),
    ).toBeInTheDocument();

    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  });
});
