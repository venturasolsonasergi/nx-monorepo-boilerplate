import {
  createRoute,
  lazyRouteComponent,
  redirect,
  type AnyRoute,
} from '@tanstack/react-router';
import { validateReturnToSearch } from '../../../shared/lib/return-to';

// Routes live inside the feature; app/router.tsx only composes them under the
// workspace layout route.
export function createSettingsRoutes(parentRoute: AnyRoute) {
  const settingsRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: '/settings',
    validateSearch: validateReturnToSearch,
    staticData: { workspaceTitle: 'nav.profile' },
    component: lazyRouteComponent(() => import('./settings-page')),
  });

  // The account settings page replaced the former `/users` profile route.
  const legacyUsersRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: '/users',
    beforeLoad: () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router redirects are thrown control-flow objects, not Errors.
      throw redirect({ to: '/settings' });
    },
  });

  return [settingsRoute, legacyUsersRoute];
}
