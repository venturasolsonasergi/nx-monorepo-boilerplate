import { useEffect } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  profileQueryPrefix,
  sessionQueryKey,
  settingsQueryPrefix,
} from '../../../shared/lib/query-keys';
import { DASHBOARD_DESTINATION } from '../../../shared/lib/return-to';
import { Spinner } from '../../../shared/ui/spinner';
import { useSessionState } from '../hooks/use-session';

// Landed here after the OAuth provider callback. The API redirects with the
// session cookie already set, or with ?error=<code> when it fails (see
// libs/auth/infrastructure/auth.controller.ts). On success the route adopts the
// new session and continues into the settings flow; it never presents sign-in
// or profile forms itself.
export default function OAuthCallbackPage() {
  const { t } = useTranslation('auth');
  const queryClient = useQueryClient();
  const { state } = useSessionState();
  const navigate = useNavigate();
  const error = new URLSearchParams(window.location.search).get('error');

  useEffect(() => {
    if (error) {
      return;
    }

    // Adopt the new session: drop any previous caller's private caches and
    // revalidate the session established by the callback's HTTP-only cookie.
    queryClient.removeQueries({ queryKey: profileQueryPrefix });
    queryClient.removeQueries({ queryKey: settingsQueryPrefix });
    void queryClient.invalidateQueries({ queryKey: sessionQueryKey });
  }, [error, queryClient]);

  useEffect(() => {
    if (error || state !== 'authenticated') {
      return;
    }

    void navigate({
      to: '/settings',
      search: { returnTo: DASHBOARD_DESTINATION },
    });
  }, [error, state, navigate]);

  if (error) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
        <h1 className="text-lg font-semibold">{t('oauth.title')}</h1>
        <p role="alert" className="text-sm text-destructive">
          {t('oauth.failed', { error })}
        </p>
        <Link to="/login" className="text-sm underline">
          {t('oauth.toLogin')}
        </Link>
      </main>
    );
  }

  if (state === 'unauthenticated' || state === 'unknown') {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
        <h1 className="text-lg font-semibold">{t('oauth.title')}</h1>
        <p role="alert" className="text-sm text-destructive">
          {t('oauth.sessionUnresolved')}
        </p>
        <Link to="/login" className="text-sm underline">
          {t('oauth.toLogin')}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
      <h1 className="text-lg font-semibold">{t('oauth.title')}</h1>
      <Spinner />
    </main>
  );
}
