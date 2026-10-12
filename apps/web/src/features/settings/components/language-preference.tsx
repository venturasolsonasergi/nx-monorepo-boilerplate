import { useTranslation } from 'react-i18next';
import { LanguageMenu } from '../../../shared/layout/language-menu';

// Language preference control on the account settings page.
export function LanguagePreference() {
  const { t } = useTranslation('settings');

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {t('languageDescription')}
      </p>
      <LanguageMenu />
    </div>
  );
}
