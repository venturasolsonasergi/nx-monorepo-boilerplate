import {
  createRoute,
  lazyRouteComponent,
  type AnyRoute,
} from '@tanstack/react-router';

// Routes live inside the feature; app/router.tsx only composes them under the
// dashboard layout route.
export function createDashboardRoutes(parentRoute: AnyRoute) {
  const dashboardIndexRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: '/dashboard',
    staticData: { workspaceTitle: 'Panel' },
    component: lazyRouteComponent(() => import('./dashboard-page')),
  });

  return [dashboardIndexRoute];
}
