import { Link } from '@tanstack/react-router';
import { Home, LayoutDashboard, Settings as SettingsIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../shared/lib/cn';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuLabel,
  useSidebar,
} from '../../../shared/ui/sidebar';
import { Wordmark } from '../../../shared/ui/wordmark';
import { AccountFooter } from './account-footer';

const NAV_ITEMS = [
  { to: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/settings', labelKey: 'nav.profile', icon: SettingsIcon },
  { to: '/', labelKey: 'nav.home', icon: Home },
] as const;

// Only implemented destinations are listed; no demo or placeholder navigation.
export function DashboardSidebar() {
  const { t } = useTranslation('common');
  const { state, isMobile } = useSidebar();
  const collapsed = state === 'collapsed' && !isMobile;

  return (
    <Sidebar>
      <SidebarHeader>
        <Link
          to="/"
          className={cn('text-sm', collapsed && 'flex justify-center')}
          aria-label="Ir al inicio"
        >
          {collapsed ? (
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Wordmark />
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('nav.section')}</SidebarGroupLabel>
          <SidebarMenu>
            {NAV_ITEMS.map((item) => {
              const label = t(item.labelKey);
              return (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild tooltip={label}>
                    <Link
                      to={item.to}
                      aria-label={label}
                      activeOptions={{ exact: item.to === '/' }}
                      activeProps={{ className: 'bg-accent font-medium' }}
                    >
                      <item.icon
                        className="h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      <SidebarMenuLabel>{label}</SidebarMenuLabel>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <AccountFooter />
      </SidebarFooter>
    </Sidebar>
  );
}
