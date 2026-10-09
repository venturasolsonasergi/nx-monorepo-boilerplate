import { Monitor, Moon, Sun } from 'lucide-react';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionState } from '../../auth';
import { DEFAULT_LOCALE, isSupportedLocale } from '../../../shared/i18n/config';
import { cn } from '../../../shared/lib/cn';
import {
  THEMES,
  useTheme,
  type ThemePreference as ThemeValue,
} from '../../../shared/theming';
import { useUpdateSettings } from '../hooks/use-update-settings';

const THEME_ICONS: Record<ThemeValue, ComponentType<{ className?: string }>> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

// Theme preference control on the account settings page. A selection applies to
// the interface and the cache immediately, then persists through the settings
// API; a persistence failure leaves the session choice in effect.
export function ThemePreference() {
  const { t, i18n } = useTranslation('settings');
  const { state, userId } = useSessionState();
  const update = useUpdateSettings(state === 'authenticated' ? userId : null);
  const { preference, setTheme } = useTheme();

  const language = isSupportedLocale(i18n.language)
    ? i18n.language
    : DEFAULT_LOCALE;

  function choose(next: ThemeValue) {
    if (next === preference) {
      return;
    }

    setTheme(next);
    update.mutate({ language, theme: next });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{t('themeDescription')}</p>
      <div
        role="radiogroup"
        aria-label={t('theme')}
        className="flex flex-wrap gap-2"
      >
        {THEMES.map((theme) => {
          const Icon = THEME_ICONS[theme];
          const selected = preference === theme;

          return (
            <button
              key={theme}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={update.isPending}
              onClick={() => choose(theme)}
              className={cn(
                'flex items-center gap-2 rounded-md border px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50',
                selected
                  ? 'border-ring bg-accent text-accent-foreground'
                  : 'border-input bg-transparent',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t(`themes.${theme}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
