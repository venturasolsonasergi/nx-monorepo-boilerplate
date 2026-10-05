import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

export const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export type RequestIdHeaderValue = string | string[] | undefined | null;

/**
 * Resolves the correlation identifier for a request. An inbound header is only
 * reused when it is a single value matching `[A-Za-z0-9._-]{1,128}`; anything
 * else (missing, repeated, oversized, or malformed) is replaced with a freshly
 * generated UUID so untrusted input never reaches logs or response headers.
 */
export function resolveRequestId(
  headerValue: RequestIdHeaderValue,
  generate: () => string = randomUUID,
): string {
  if (typeof headerValue === 'string' && REQUEST_ID_PATTERN.test(headerValue)) {
    return headerValue;
  }

  return generate();
}
