import { Link } from '@tanstack/react-router';
import { Button } from '../../../shared/ui/button';
import { Wordmark } from '../../../shared/ui/wordmark';
import { ArchitectureOverview } from '../components/architecture-overview';

const STACK = [
  'NestJS + TypeScript (apps/api y libs)',
  'Prisma para persistencia',
  'Zod para validación',
  'pnpm workspaces y Nx',
  'React + Vite con TanStack Router/Query (apps/web)',
  'Jest, Vitest y Playwright',
];

// Factual landing page: what the project is, what it uses, and how it is built.
export default function LandingPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 p-6 sm:p-10">
      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          <Wordmark />
        </h1>
        <p className="text-base text-muted-foreground">
          Boilerplate para construir microservicios con NestJS y desarrollo
          guiado por especificaciones (SDD): las capacidades se describen como
          requisitos antes de implementarlas.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/login">Acceder</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/signup">Crear cuenta</Link>
          </Button>
        </div>
      </section>

      <section aria-labelledby="landing-stack">
        <h2 id="landing-stack" className="text-lg font-semibold">
          Tecnologías
        </h2>
        <ul className="mt-3 grid list-disc gap-1 pl-5 text-sm text-muted-foreground sm:grid-cols-2">
          {STACK.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="landing-architecture">
        <h2 id="landing-architecture" className="text-lg font-semibold">
          Arquitectura
        </h2>
        <div className="mt-3">
          <ArchitectureOverview />
        </div>
      </section>
    </main>
  );
}
