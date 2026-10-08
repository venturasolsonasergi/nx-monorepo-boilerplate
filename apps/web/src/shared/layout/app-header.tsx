import { Link } from '@tanstack/react-router';
import { User as UserIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Spinner } from '../ui/spinner';
import { Wordmark } from '../ui/wordmark';
import { LanguageSwitcher } from './language-switcher';
import { AccountMenuItems } from './account/account-menu-items';
import { useAccount } from './account/use-account';

// Shared header for public routes. The user control's menu reflects the resolved
// session state: pending, unauthenticated, authenticated, or unknown.
export function AppHeader() {
  const { t } = useTranslation('common');
  const account = useAccount();
  const { state, logout } = account;

  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
      <Link to="/" className="text-sm">
        <Wordmark />
      </Link>
      <div className="flex items-center gap-3">
        {state !== 'authenticated' ? <LanguageSwitcher /> : null}
        {logout.isError ? (
          <div
            role="alert"
            className="flex items-center gap-2 text-xs text-destructive"
          >
            <span>{t('account.logoutError')}</span>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
            >
              {t('account.retry')}
            </Button>
          </div>
        ) : null}
        {state === 'pending' ? (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            disabled
            aria-label={t('header.checkSession')}
          >
            <Spinner />
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                aria-label={t('header.accountControl')}
              >
                <UserIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <AccountMenuItems account={account} />
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
