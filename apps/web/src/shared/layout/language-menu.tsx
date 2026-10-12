import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LOCALES, isSupportedLocale } from '../i18n/config';
import { cn } from '../lib/cn';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { useLanguageChange } from './use-language-change';

// Shared language control: a circular icon button opening a dropdown whose
// active locale is marked. Reused by the public header and the settings page.
export function LanguageMenu({ className }: { className?: string }) {
  const { t } = useTranslation(['common', 'settings']);
  const { current, change, isPending } = useLanguageChange();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          aria-label={t('settings:language')}
          disabled={isPending}
          className={cn('rounded-full', className)}
        >
          <Languages className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={(next) => {
            if (isSupportedLocale(next)) {
              change(next);
            }
          }}
        >
          {SUPPORTED_LOCALES.map((locale) => (
            <DropdownMenuRadioItem key={locale} value={locale}>
              {t(`settings:languages.${locale}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
