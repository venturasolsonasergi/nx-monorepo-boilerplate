import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import i18n, {
  DEFAULT_LOCALE,
  isSupportedLocale,
  type Locale,
} from '../../../shared/i18n/config';
import {
  ensureSignedInLanguage,
  switchLocale,
} from '../../../shared/i18n/routing';
import {
  profileQueryPrefix,
  sessionQueryKey,
  settingsQueryPrefix,
} from '../../../shared/lib/query-keys';
import { authorizedReturnTo } from '../../../shared/lib/return-to';
import { authApi, type Credentials } from '../api/auth.api';

// On success, set the session to the signed-in user, drop any prior user's
// cached private data, revalidate the session, ensure the caller's language
// preference exists (creating the default when none was stored), apply it, and
// continue to the dashboard (or the authorized `returnTo`).
export function useLogin(returnTo?: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (input: Credentials) => authApi.login(input),
    onSuccess: async (data) => {
      queryClient.setQueryData(sessionQueryKey, data);
      queryClient.removeQueries({ queryKey: profileQueryPrefix });
      queryClient.removeQueries({ queryKey: settingsQueryPrefix });
      await queryClient.invalidateQueries({ queryKey: sessionQueryKey });

      const destination = authorizedReturnTo(returnTo) ?? '/dashboard';
      const language = await ensureSignedInLanguage();
      const activeLocale: Locale = isSupportedLocale(i18n.language)
        ? i18n.language
        : DEFAULT_LOCALE;

      if (language && language !== activeLocale) {
        switchLocale(language, destination);
        return;
      }

      await navigate({ to: destination });
    },
  });
}
