import { cn } from '../lib/cn';

// Typographic wordmark — the project name with a brand accent, no logo mark.
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-semibold tracking-tight', className)}>
      <span className="text-brand">nx</span>-monorepo-boilerplate
    </span>
  );
}
