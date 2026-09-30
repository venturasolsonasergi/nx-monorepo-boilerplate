import { Suspense } from 'react';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router';
import { createUsersRoutes } from '../features/users/routes/users.routes';

function RootLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
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

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <div className="p-6 text-sm">Bienvenido. Ve a /users.</div>,
});

// Each feature owns and exports its own routes; the router only composes them.
const routeTree = rootRoute.addChildren([
  indexRoute,
  ...createUsersRoutes(rootRoute),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
