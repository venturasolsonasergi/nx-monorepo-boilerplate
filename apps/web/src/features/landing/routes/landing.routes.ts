import {
  createRoute,
  lazyRouteComponent,
  type AnyRoute,
} from '@tanstack/react-router';

// Routes live inside the feature; app/router.tsx only composes them under the root route.
export function createLandingRoutes(parentRoute: AnyRoute) {
  const landingRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: '/',
    component: lazyRouteComponent(() => import('./landing-page')),
  });

  return [landingRoute];
}
