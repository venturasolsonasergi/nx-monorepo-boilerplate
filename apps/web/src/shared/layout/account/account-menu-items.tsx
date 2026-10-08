import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../../ui/dropdown-menu';
import type { Account } from './use-account';

// Dropdown items shared by the header's user menu. The dashboard sidebar footer
// renders the same account state with its own markup.
export function AccountMenuItems({ account }: { account: Account }) {
  const { t } = useTranslation('common');
  const { state, refetch, logout } = account;

  if (state === 'authenticated') {
    return (
      <>
        <DropdownMenuItem asChild>
          <Link to="/settings">{t('header.profile')}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/dashboard">{t('header.dashboard')}</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={logout.isPending}
          onSelect={() => {
            logout.mutate();
          }}
        >
          {t('header.logout')}
        </DropdownMenuItem>
      </>
    );
  }

  if (state === 'unauthenticated') {
    return (
      <DropdownMenuItem asChild>
        <Link to="/login">{t('header.login')}</Link>
      </DropdownMenuItem>
    );
  }

  return (
    <>
      <DropdownMenuLabel>{t('account.sessionUnknown')}</DropdownMenuLabel>
      <DropdownMenuItem
        onSelect={() => {
          refetch();
        }}
      >
        {t('account.retry')}
      </DropdownMenuItem>
    </>
  );
}
