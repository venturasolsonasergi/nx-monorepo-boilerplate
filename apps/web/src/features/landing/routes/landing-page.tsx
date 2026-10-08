import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../shared/ui/button';
import { Wordmark } from '../../../shared/ui/wordmark';
import { ArchitectureOverview } from '../components/architecture-overview';

const STACK_KEYS = [
  'nestjs',
  'prisma',
  'zod',
  'pnpm',
  'react',
  'i18n',
  'testing',
] as const;

// Factual landing page: what the project is, what it uses, and how it is built.
export default function LandingPage() {
  const { t } = useTranslation('landing');

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 p-6 sm:p-10">
      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          <Wordmark />
        </h1>
        <p className="text-base text-muted-foreground">{t('purpose')}</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/login">{t('login')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/signup">{t('signup')}</Link>
          </Button>
        </div>
      </section>

      <section aria-labelledby="landing-stack">
        <h2 id="landing-stack" className="text-lg font-semibold">
          {t('stackTitle')}
        </h2>
        <ul className="mt-3 grid list-disc gap-1 pl-5 text-sm text-muted-foreground sm:grid-cols-2">
          {STACK_KEYS.map((key) => (
            <li key={key}>{t(`stack.${key}`)}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="landing-architecture">
        <h2 id="landing-architecture" className="text-lg font-semibold">
          {t('architectureTitle')}
        </h2>
        <div className="mt-3">
          <ArchitectureOverview />
        </div>
      </section>
    </main>
  );
}
