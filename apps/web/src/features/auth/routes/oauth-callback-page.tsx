import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

// Landed here after the OAuth provider callback (the API redirects with the
// session cookie already set, or with ?error=<code> when it fails).
export default function OAuthCallbackPage() {
  const { t } = useTranslation('auth');
  const error = new URLSearchParams(window.location.search).get('error');

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-lg font-semibold">{t('oauth.title')}</h1>
      {error ? (
        <p className="text-sm text-red-600">{t('oauth.failed', { error })}</p>
      ) : (
        <p className="text-sm text-green-700">{t('oauth.success')}</p>
      )}
      <Link to="/settings" className="text-sm underline">
        {t('oauth.continue')}
      </Link>
    </div>
  );
}
