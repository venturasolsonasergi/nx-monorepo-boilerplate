import { Link, useNavigate } from '@tanstack/react-router';
import { LogIn, LogOut, RefreshCw, User as UserIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAccount } from '../../../shared/layout/account/use-account';
import { cn } from '../../../shared/lib/cn';
import { Button } from '../../../shared/ui/button';
import { Spinner } from '../../../shared/ui/spinner';
import { useSidebar } from '../../../shared/ui/sidebar';
import { useLogoutTransition } from '../lib/logout-transition';

// Dashboard footer account control. It reuses the shared account unit and, on a
// successful logout, continues to the landing instead of the login page. When the
// sidebar is collapsed only icons are shown; each control keeps an accessible name.
export function AccountFooter() {
  const { t } = useTranslation('common');
  const { state, displayName, refetch, logout } = useAccount();
  const navigate = useNavigate();
  const { setLoggingOut } = useLogoutTransition();
  const { state: sidebarState, isMobile } = useSidebar();
  const collapsed = sidebarState === 'collapsed' && !isMobile;

  const handleLogout = () => {
    setLoggingOut(true);
    logout.mutate(undefined, {
      onSuccess: () => {
        void navigate({ to: '/' });
      },
      onError: () => {
        setLoggingOut(false);
      },
    });
  };

  if (state === 'pending') {
    return (
      <div
        className={cn(
          'text-muted-foreground flex items-center gap-2 text-sm',
          collapsed && 'justify-center',
        )}
      >
        <Spinner />
        {collapsed ? null : <span>{t('account.sessionPending')}</span>}
      </div>
    );
  }

  if (state === 'unknown') {
    if (collapsed) {
      return (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            aria-label={t('account.retry')}
            onClick={refetch}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        <p role="alert" className="text-destructive text-xs">
          {t('account.sessionUnknown')}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={refetch}>
          {t('account.retry')}
        </Button>
      </div>
    );
  }

  if (state === 'unauthenticated') {
    if (collapsed) {
      return (
        <div className="flex justify-center">
          <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Link to="/login" aria-label={t('header.login')}>
              <LogIn className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      );
    }
    return (
      <Button asChild variant="outline" size="sm">
        <Link to="/login">{t('header.login')}</Link>
      </Button>
    );
  }

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1">
        <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Link to="/settings" aria-label={t('header.profile')}>
            <UserIcon className="h-4 w-4" />
          </Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label={t('header.logout')}
          disabled={logout.isPending}
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
        </Button>
        {logout.isError ? (
          <p role="alert" className="sr-only">
            {t('account.logoutError')}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="truncate text-sm font-medium">
        {displayName ?? t('account.session')}
      </p>
      <Button asChild variant="ghost" size="sm" className="justify-start">
        <Link to="/settings">{t('header.profile')}</Link>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="justify-start"
        disabled={logout.isPending}
        onClick={handleLogout}
      >
        {t('header.logout')}
      </Button>
      {logout.isError ? (
        <p role="alert" className="text-destructive text-xs">
          {t('account.logoutError')}
        </p>
      ) : null}
    </div>
  );
}
