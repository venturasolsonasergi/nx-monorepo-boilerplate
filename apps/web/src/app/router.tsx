import { Suspense } from 'react';
import { createRootRoute, createRouter, Outlet } from '@tanstack/react-router';
import { createAuthRoutes } from '../features/auth/routes/auth.routes';
import { createLandingRoutes } from '../features/landing';
import { createUsersRoutes } from '../features/users/routes/users.routes';
import { AppHeader } from '../shared/layout/app-header';

function RootLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <Suspense
        fallback={
          <div className="p-6 text-sm text-muted-foreground">Cargando…</div>
        }
      >
        <Outlet />
      </Suspense>
    </div>
  );
}

export const rootRoute = createRootRoute({ component: RootLayout });

// Each feature owns and exports its own routes; the router only composes them.
const routeTree = rootRoute.addChildren([
  ...createLandingRoutes(rootRoute),
  ...createAuthRoutes(rootRoute),
  ...createUsersRoutes(rootRoute),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
