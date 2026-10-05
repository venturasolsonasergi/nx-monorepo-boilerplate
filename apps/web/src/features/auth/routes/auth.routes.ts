import {
  createRoute,
  lazyRouteComponent,
  type AnyRoute,
} from '@tanstack/react-router';

// Routes live inside the feature; app/router.tsx only composes them under the root route.
export function createAuthRoutes(parentRoute: AnyRoute) {
  const loginRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: '/login',
    component: lazyRouteComponent(() => import('./login-page')),
  });

  const signupRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: '/signup',
    component: lazyRouteComponent(() => import('./signup-page')),
  });

  const forgotPasswordRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: '/forgot-password',
    component: lazyRouteComponent(() => import('./forgot-password-page')),
  });

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

  return [
    loginRoute,
    signupRoute,
    forgotPasswordRoute,
    verifiedRoute,
    resetPasswordRoute,
    oauthCallbackRoute,
  ];
}
