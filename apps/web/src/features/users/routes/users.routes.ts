import {
  createRoute,
  lazyRouteComponent,
  type AnyRoute,
} from '@tanstack/react-router';
import { validateReturnToSearch } from '../../../shared/lib/return-to';

// Routes live inside the feature; app/router.tsx only composes them under the root route.
export function createUsersRoutes(parentRoute: AnyRoute) {
  const usersIndexRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: '/users',
    validateSearch: validateReturnToSearch,
    staticData: { workspaceTitle: 'Mi perfil' },
    component: lazyRouteComponent(() => import('./users-page')),
  });

  return [usersIndexRoute];
}
