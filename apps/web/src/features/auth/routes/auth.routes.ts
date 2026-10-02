import {
  createRoute,
  lazyRouteComponent,
  type AnyRoute,
} from '@tanstack/react-router';

// Routes live inside the feature; app/router.tsx only composes them under the root route.
export function createAuthRoutes(parentRoute: AnyRoute) {
  const verifiedRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: '/verified',
    component: lazyRouteComponent(() => import('./verified-page')),
  });

  const resetPasswordRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: '/reset-password',
    component: lazyRouteComponent(() => import('./reset-password-page')),
  });

  const oauthCallbackRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: '/auth/oauth/callback',
    component: lazyRouteComponent(() => import('./oauth-callback-page')),
  });

  return [verifiedRoute, resetPasswordRoute, oauthCallbackRoute];
}
