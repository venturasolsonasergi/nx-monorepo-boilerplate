import { Suspense } from 'react';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router';
import { createAuthRoutes } from '../features/auth/routes/auth.routes';
import { createDashboardRoutes } from '../features/dashboard';
import { WorkspaceLayout } from '../features/dashboard/routes/workspace-layout';
import { createLandingRoutes } from '../features/landing';
import { createUsersRoutes } from '../features/users/routes/users.routes';
import { PublicLayout } from '../shared/layout/public-layout';

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

// Pathless layouts decide the chrome: public pages share the header, the
// workspace renders the sidebar shell. No pathname conditionals.
const publicLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'public',
  component: PublicLayout,
});

const workspaceLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'workspace',
  component: WorkspaceLayout,
});

// Each feature owns and exports its own routes; the router only composes them.
const routeTree = rootRoute.addChildren([
  publicLayoutRoute.addChildren([
    ...createLandingRoutes(publicLayoutRoute),
    ...createAuthRoutes(publicLayoutRoute),
  ]),
  workspaceLayoutRoute.addChildren([
    ...createDashboardRoutes(workspaceLayoutRoute),
    ...createUsersRoutes(workspaceLayoutRoute),
  ]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
