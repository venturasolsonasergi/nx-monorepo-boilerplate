import { Languages } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SUPPORTED_LOCALES,
  isSupportedLocale,
} from '../../../shared/i18n/config';
import { useLanguageChange } from '../../../shared/layout/use-language-change';

// Language preference control on the account settings page.
export function LanguagePreference() {
  const { t } = useTranslation('settings');
  const { current, change, isPending } = useLanguageChange();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    if (isSupportedLocale(next)) {
      change(next);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {t('languageDescription')}
      </p>
      <div className="flex items-center gap-2">
        <Languages
          className="h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <select
          aria-label={t('language')}
          value={current}
          onChange={handleChange}
          disabled={isPending}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        >
          {SUPPORTED_LOCALES.map((locale) => (
            <option key={locale} value={locale}>
              {t(`languages.${locale}`)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
