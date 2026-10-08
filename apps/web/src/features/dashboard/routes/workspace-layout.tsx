import { Outlet, useMatches } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { workspaceTitleFromMatches } from '../../../shared/lib/workspace-title';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '../../../shared/ui/sidebar';
import { DashboardSidebar } from '../components/dashboard-sidebar';
import { LogoutTransitionProvider } from '../lib/logout-transition';

// Pathless layout for the authenticated workspace. The shell is composed here so
// `/dashboard` and `/settings` do not render the public header. The compact-header
// title comes from each route's `staticData.workspaceTitle` translation key.
export function WorkspaceLayout() {
  const { t } = useTranslation('common');
  const titleKey = useMatches({
    select: (matches) =>
      workspaceTitleFromMatches(
        matches as unknown as ReadonlyArray<{ staticData?: unknown }>,
      ),
  });

  return (
    <LogoutTransitionProvider>
      <SidebarProvider>
        <DashboardSidebar />
        <SidebarInset>
          <header className="flex items-center gap-3 border-b border-border px-4 py-3">
            <SidebarTrigger />
            <span className="text-sm font-semibold">{t(titleKey)}</span>
          </header>
          <div className="flex-1">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </LogoutTransitionProvider>
  );
}
