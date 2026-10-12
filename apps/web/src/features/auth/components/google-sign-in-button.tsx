import { useTranslation } from 'react-i18next';
import { Button } from '../../../shared/ui/button';
import { Spinner } from '../../../shared/ui/spinner';
import { usePublicConfig } from '../hooks/use-public-config';
import { useStartOAuth } from '../hooks/use-start-oauth';
import { GoogleIcon } from './google-icon';

const GOOGLE_PROVIDER = 'google';

// Renders the provider sign-in action only when the API's public configuration
// reports the provider as usable. A failed or missing configuration means "no
// social options known", so the email flows remain the only entry point and no
// button is fabricated.
export function GoogleSignInButton() {
  const { t } = useTranslation('auth');
  const config = usePublicConfig();
  const start = useStartOAuth();

  const providers = config.data?.allowedProviders ?? [];
  if (!providers.includes(GOOGLE_PROVIDER)) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={start.isPending}
        onClick={() => start.mutate(GOOGLE_PROVIDER)}
      >
        {start.isPending ? <Spinner /> : <GoogleIcon className="h-4 w-4" />}
        {start.isPending ? t('google.pending') : t('google.continue')}
      </Button>
      {start.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {t('google.failed')}
        </p>
      ) : null}
    </div>
  );
}
