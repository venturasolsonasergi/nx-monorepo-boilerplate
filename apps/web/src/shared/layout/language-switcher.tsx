import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LOCALES, isSupportedLocale } from '../i18n/config';
import { cn } from '../lib/cn';
import { useLanguageChange } from './use-language-change';

// Bare language selector for the public header (shown to anonymous visitors).
export function LanguageSwitcher({ className }: { className?: string }) {
  const { t } = useTranslation(['common', 'settings']);
  const { current, change, isPending } = useLanguageChange();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    if (isSupportedLocale(next)) {
      change(next);
    }
  }

  return (
    <select
      aria-label={t('settings:language')}
      value={current}
      onChange={handleChange}
      disabled={isPending}
      className={cn(
        'h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50',
        className,
      )}
    >
      {SUPPORTED_LOCALES.map((locale) => (
        <option key={locale} value={locale}>
          {t(`settings:languages.${locale}`)}
        </option>
      ))}
    </select>
  );
}
