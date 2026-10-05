import type { Logger } from 'pino';

export type LogModule = 'api' | 'auth' | 'users' | 'orders';

export const LOG_MODULES: readonly LogModule[] = [
  'api',
  'auth',
  'users',
  'orders',
];

export interface RequestLike {
  url?: string;
  originalUrl?: string;
  method?: string;
  baseUrl?: string;
  route?: { path?: string };
}

function pathnameOf(url: string | undefined): string {
  if (!url) {
    return '';
  }

  return url.split('#', 1)[0].split('?', 1)[0];
}

/**
 * The original request path. `req.url` is mutated while a request passes
 * through mounted routers (middleware can strip the mount prefix), so the
 * stable `originalUrl` is preferred when present.
 */
function effectivePath(request: RequestLike): string {
  return pathnameOf(request.originalUrl ?? request.url);
}

/**
 * Maps a request path to the operational module that owns it. Only the path
 * prefix is inspected, so route-parameter values and query strings never become
 * part of the derived binding.
 */
export function moduleForPath(pathname: string | undefined): LogModule {
  const clean = pathnameOf(pathname);

  if (clean === '/auth' || clean.startsWith('/auth/')) {
    return 'auth';
  }
  if (clean === '/users' || clean.startsWith('/users/')) {
    return 'users';
  }
  if (clean === '/orders' || clean.startsWith('/orders/')) {
    return 'orders';
  }

  return 'api';
}

export function moduleForRequest(request: RequestLike): LogModule {
  return moduleForPath(effectivePath(request));
}

function isWildcardRoute(path: string): boolean {
  return path.includes('*') || path.includes('{');
}

/**
 * The stable base path of a request, used when no real controller route has
 * matched — for example a request rejected by middleware. Only the owning
 * module prefix is returned, never an arbitrary or parameter-bearing path, so
 * raw values cannot leak. Unknown paths return `undefined`.
 */
function basePathOf(request: RequestLike): string | undefined {
  const pathname = effectivePath(request);
  if (pathname === '/') {
    return '/';
  }

  const module = moduleForPath(pathname);
  return module === 'api' ? undefined : `/${module}`;
}

/**
 * Returns the matched route template (for example `/users/:id`). Wildcard
 * routes (such as the logging middleware's own `/{*splat}`) are ignored in
 * favour of the stable base path, so middleware failures keep their owning
 * module's route instead of a splat pattern. Raw request paths and parameter
 * values are never returned.
 */
export function routeTemplate(request: RequestLike): string | undefined {
  const route = request.route?.path;
  if (route && !isWildcardRoute(route)) {
    const combined = `${request.baseUrl ?? ''}${route}`;
    return combined.startsWith('/') ? combined : `/${combined}`;
  }

  return basePathOf(request);
}

/**
 * Derives a contextual child logger from the single shared host logger. The
 * child only adds the stable `module` binding (and an optional `component`
 * binding); it never introduces its own level, transport, redaction, or
 * destination.
 */
export function createModuleLogger<
  CustomLevels extends string = never,
  UseOnlyCustomLevels extends boolean = boolean,
>(
  base: Logger<CustomLevels, UseOnlyCustomLevels>,
  module: LogModule,
  component?: string,
): Logger<CustomLevels, UseOnlyCustomLevels> {
  return base.child({
    module,
    ...(component ? { component } : {}),
  }) as Logger<CustomLevels, UseOnlyCustomLevels>;
}
