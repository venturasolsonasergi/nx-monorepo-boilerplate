import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useSessionState } from '../../auth';
import {
  isNotFoundError,
  isUnauthenticatedError,
} from '../../../shared/lib/api-client';
import { clearPrivateCaches } from '../../../shared/lib/private-cache';
import {
  authorizedReturnTo,
  validateReturnToSearch,
} from '../../../shared/lib/return-to';
import { LanguagePreference } from '../components/language-preference';
import { Button } from '../../../shared/ui/button';
import { Spinner } from '../../../shared/ui/spinner';
import { ProfileView, useProfile } from '../../users';
import type { Profile } from '../../users';
import { ProfileForm } from '../components/profile-form';
import { useCompleteProfile } from '../hooks/use-complete-profile';

const PAGE = 'mx-auto flex max-w-2xl flex-col gap-6 p-6';

// Lazily loaded via lazyRouteComponent — must be the default export.
export default function SettingsPage() {
  const { t } = useTranslation('settings');
  const { returnTo } = validateReturnToSearch(useSearch({ strict: false }));
  const { state, userId, refetch } = useSessionState();

  if (state === 'pending') {
    return (
      <main className={PAGE}>
        <Spinner />
      </main>
    );
  }

  if (state === 'unauthenticated') {
    return (
      <main className={PAGE}>
        <h1 className="text-lg font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('unauthenticated')}</p>
        <Link to="/login" className="text-sm underline">
          {t('signIn')}
        </Link>
      </main>
    );
  }

  if (state === 'unknown') {
    return (
      <main className={PAGE}>
        <h1 className="text-lg font-semibold">{t('title')}</h1>
        <p role="alert" className="text-sm text-destructive">
          {t('sessionUnknown')}
        </p>
        <Button type="button" variant="outline" onClick={refetch}>
          {t('retry')}
        </Button>
      </main>
    );
  }

  return <SettingsSection userId={userId as string} returnTo={returnTo} />;
}

function SettingsSection({
  userId,
  returnTo,
}: {
  userId: string;
  returnTo?: string;
}) {
  const profile = useProfile(userId);
  const navigate = useNavigate();
  const destination = authorizedReturnTo(returnTo);

  // An authorized destination continues to `/dashboard` for both the existing
  // (200) and the created (201) profile, once the profile is available.
  useEffect(() => {
    if (destination && profile.isSuccess) {
      void navigate({ to: destination });
    }
  }, [destination, profile.isSuccess, navigate]);

  if (profile.isPending) {
    return (
      <main className={PAGE}>
        <Spinner />
      </main>
    );
  }

  if (profile.isError) {
    if (isUnauthenticatedError(profile.error)) {
      return <ExpiredSession />;
    }
    if (isNotFoundError(profile.error)) {
      return <CreateProfile userId={userId} />;
    }
    return <ProfileUnavailable onRetry={() => void profile.refetch()} />;
  }

  if (destination) {
    return (
      <main className={PAGE}>
        <Spinner />
      </main>
    );
  }

  return <SettingsContent profile={profile.data} />;
}

function SettingsContent({ profile }: { profile: Profile }) {
  const { t } = useTranslation('settings');

  return (
    <main className={PAGE}>
      <ProfileView profile={profile} />
      <section aria-labelledby="settings-language">
        <h2 id="settings-language" className="text-lg font-semibold">
          {t('languageTitle')}
        </h2>
        <div className="mt-3">
          <LanguagePreference />
        </div>
      </section>
    </main>
  );
}

function CreateProfile({ userId }: { userId: string }) {
  const { t } = useTranslation('settings');
  const complete = useCompleteProfile(userId);

  return (
    <main className={PAGE}>
      <h1 className="text-lg font-semibold">{t('createTitle')}</h1>
      <ProfileForm
        isSubmitting={complete.isPending}
        onSubmit={(input) => complete.mutate(input)}
      />
    </main>
  );
}

function ProfileUnavailable({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation('settings');

  return (
    <main className={PAGE}>
      <h1 className="text-lg font-semibold">{t('title')}</h1>
      <p role="alert" className="text-sm text-destructive">
        {t('profileUnavailable')}
      </p>
      <Button type="button" variant="outline" onClick={onRetry}>
        {t('retry')}
      </Button>
    </main>
  );
}

function ExpiredSession() {
  const { t } = useTranslation('settings');
  const queryClient = useQueryClient();

  useEffect(() => {
    void clearPrivateCaches(queryClient);
  }, [queryClient]);

  return (
    <main className={PAGE}>
      <h1 className="text-lg font-semibold">{t('title')}</h1>
      <p className="text-sm text-muted-foreground">{t('expired')}</p>
      <Link to="/login" className="text-sm underline">
        {t('signIn')}
      </Link>
    </main>
  );
}
