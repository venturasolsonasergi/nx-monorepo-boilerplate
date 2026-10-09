import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { useTheme } from '../theming';

// Anonymous-only header control: it toggles between light and dark, resolving
// `system` through the current OS scheme first, and caches the explicit choice.
// There is no path back to `system` without signing in.
export function ThemeToggle() {
  const { t } = useTranslation('common');
  const { resolvedTheme, setTheme } = useTheme();
  const next = resolvedTheme === 'dark' ? 'light' : 'dark';

  return (
    <Button
      variant="ghost"
      size="sm"
      type="button"
      aria-label={t('header.toggleTheme')}
      onClick={() => setTheme(next)}
    >
      {resolvedTheme === 'dark' ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}
