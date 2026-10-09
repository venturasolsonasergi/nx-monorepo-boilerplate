import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useAccount } from '../../auth';
import { isUnauthenticatedError } from '../../../shared/lib/api-client';
import { clearPrivateCaches } from '../../../shared/lib/private-cache';
import { Button } from '../../../shared/ui/button';
import { ChangePasswordDialog } from './change-password-dialog';

// Discloses the session identity's email and password metadata, and hosts the
// change-password dialog. The entry point stays hidden while the identity has
// no password credential (for example an OAuth-only account).
export function AccountSecuritySection() {
  const { t, i18n } = useTranslation('settings');
  const account = useAccount(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [changed, setChanged] = useState(false);

  if (account.isPending) {
    return (
      <section aria-labelledby="settings-account-security">
        <h2 id="settings-account-security" className="text-lg font-semibold">
          {t('accountSecurity.title')}
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          {t('accountSecurity.loading')}
        </p>
      </section>
    );
  }

  if (account.isError) {
    if (isUnauthenticatedError(account.error)) {
      return <ExpiredAccountSession />;
    }

    return (
      <section aria-labelledby="settings-account-security">
        <h2 id="settings-account-security" className="text-lg font-semibold">
          {t('accountSecurity.title')}
        </h2>
        <p role="alert" className="mt-3 text-sm text-destructive">
          {t('accountSecurity.unavailable')}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={() => void account.refetch()}
        >
          {t('retry')}
        </Button>
      </section>
    );
  }

  const summary = account.data;
  const passwordUpdatedAt = summary.hasPassword
    ? new Date(summary.passwordUpdatedAt).toLocaleString(i18n.language)
    : null;

  return (
    <section aria-labelledby="settings-account-security">
      <h2 id="settings-account-security" className="text-lg font-semibold">
        {t('accountSecurity.title')}
      </h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">
            {t('accountSecurity.email')}
          </dt>
          <dd className="text-sm">{summary.email}</dd>
        </div>
        {summary.hasPassword ? (
          <div>
            <dt className="text-xs text-muted-foreground">
              {t('accountSecurity.passwordLastChanged')}
            </dt>
            <dd className="text-sm">{passwordUpdatedAt}</dd>
          </div>
        ) : null}
      </dl>
      {summary.hasPassword ? (
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={() => {
            setChanged(false);
            setDialogOpen(true);
          }}
        >
          {t('accountSecurity.changePassword')}
        </Button>
      ) : null}
      {changed ? (
        <p role="status" className="mt-3 text-sm text-green-700">
          {t('accountSecurity.changed')}
        </p>
      ) : null}
      <ChangePasswordDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onChanged={() => setChanged(true)}
      />
    </section>
  );
}

function ExpiredAccountSession() {
  const { t } = useTranslation('settings');
  const queryClient = useQueryClient();

  useEffect(() => {
    void clearPrivateCaches(queryClient);
  }, [queryClient]);

  return (
    <section aria-labelledby="settings-account-security">
      <h2 id="settings-account-security" className="text-lg font-semibold">
        {t('accountSecurity.title')}
      </h2>
      <p className="mt-3 text-sm text-muted-foreground">{t('expired')}</p>
      <Link to="/login" className="mt-3 inline-block text-sm underline">
        {t('signIn')}
      </Link>
    </section>
  );
}
