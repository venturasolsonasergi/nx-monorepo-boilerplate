import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
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
import { createSettingsRoutes } from '../features/settings';
import { PublicLayout } from '../shared/layout/public-layout';

function RootLayout() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Suspense
        fallback={
          <div className="p-6 text-sm text-muted-foreground">
            {t('app.loading')}
          </div>
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
export const routeTree = rootRoute.addChildren([
  publicLayoutRoute.addChildren([
    ...createLandingRoutes(publicLayoutRoute),
    ...createAuthRoutes(publicLayoutRoute),
  ]),
  workspaceLayoutRoute.addChildren([
    ...createDashboardRoutes(workspaceLayoutRoute),
    ...createSettingsRoutes(workspaceLayoutRoute),
  ]),
]);

// The locale is the router basepath, so every in-app link and navigation stays
// under the active locale prefix without feature code special-casing it.
export function createAppRouter(basepath: string) {
  return createRouter({ routeTree, basepath });
}

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter;
  }
}
