import { useSessionState } from '../../features/auth';
import { useUpdateSettings } from '../../features/settings';
import i18n, {
  DEFAULT_LOCALE,
  isSupportedLocale,
  type Locale,
} from '../i18n/config';
import { switchLocale } from '../i18n/routing';

// Applies a language change. Anonymous callers only change the URL; signed-in
// callers persist the choice first, then navigate to the new locale.
export function useLanguageChange() {
  const { state, userId } = useSessionState();
  const update = useUpdateSettings(userId);
  const current: Locale = isSupportedLocale(i18n.language)
    ? i18n.language
    : DEFAULT_LOCALE;

  function change(next: Locale) {
    if (next === current) {
      return;
    }

    if (state === 'authenticated') {
      update.mutate(
        { language: next },
        { onSettled: () => switchLocale(next, window.location.pathname) },
      );
    } else {
      switchLocale(next, window.location.pathname);
    }
  }

  return { current, change, isPending: update.isPending };
}
