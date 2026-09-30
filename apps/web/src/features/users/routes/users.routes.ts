import {
  createRoute,
  lazyRouteComponent,
  type AnyRoute,
} from '@tanstack/react-router';

// Routes live inside the feature; app/router.tsx only composes them under the root route.
export function createUsersRoutes(parentRoute: AnyRoute) {
  const usersIndexRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: '/users',
    component: lazyRouteComponent(() => import('./users-page')),
  });

  return [usersIndexRoute];
}
