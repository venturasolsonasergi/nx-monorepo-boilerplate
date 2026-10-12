import { LanguageMenu } from './language-menu';

// Language control for the public header (shown to anonymous visitors).
export function LanguageSwitcher({ className }: { className?: string }) {
  return <LanguageMenu className={className} />;
}
