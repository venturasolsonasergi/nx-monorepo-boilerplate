import type { IncomingMessage } from 'node:http';

export const SESSION_COOKIE_NAME = 'better-auth.session_token';

export function readCookieHeader(
  request: IncomingMessage & { headers: Record<string, unknown> },
): string | undefined {
  const cookie = request.headers.cookie;
  return typeof cookie === 'string' && cookie.length > 0 ? cookie : undefined;
}
