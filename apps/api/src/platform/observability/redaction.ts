import type { redactOptions } from 'pino';

export const REDACTION_CENSOR = '[Redacted]';

export const SENSITIVE_ROOT_KEYS: readonly string[] = [
  'authorization',
  'cookie',
  'set-cookie',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'password',
  'passwd',
  'pwd',
  'secret',
  'credential',
  'credentials',
  'apiKey',
  'api_key',
  'cardNumber',
  'card_number',
  'cardSecurityCode',
  'card_security_code',
  'paymentCardNumber',
  'payment_card_number',
  'cvv',
  'cvc',
];

const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SENSITIVE_KEY_PATTERN = new RegExp(
  `^(?:${SENSITIVE_ROOT_KEYS.map(escapeRegExp).join('|')})$`,
  'i',
);

const FREE_TEXT_SECRET_PATTERN = new RegExp(
  `(?<![A-Za-z0-9_])(${SENSITIVE_ROOT_KEYS.map(escapeRegExp).join(
    '|',
  )})(\\s*[:=]\\s*)("[^"]*"|'[^']*'|[^\\s,;{}"']+)`,
  'gi',
);

const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

/**
 * Replaces secret-looking `key=value` and `key: value` fragments and bearer
 * tokens inside free-form text (for example an exception message or stack)
 * while leaving the surrounding text intact.
 */
export function scrubSecrets(text: string): string {
  return text
    .replace(
      FREE_TEXT_SECRET_PATTERN,
      (_match, key: string, separator: string) =>
        `${key}${separator}${REDACTION_CENSOR}`,
    )
    .replace(BEARER_TOKEN_PATTERN, `Bearer ${REDACTION_CENSOR}`);
}

/**
 * Final safety net applied to every serialized log line. The line is parsed
 * back to a structured record and recursively sanitized, so sensitive keys,
 * free-form secrets (in ordinary fields as well as error messages/stacks), and
 * values that reached the logger through child bindings are all covered —
 * including secrets wrapped in quotes or containing JSON metacharacters. The
 * result is re-serialized, so the line always stays valid JSON.
 */
export function scrubSerializedLine(line: string): string {
  const hasNewline = line.endsWith('\n');
  const payload = hasNewline ? line.slice(0, -1) : line;

  try {
    const sanitized = redactValue(JSON.parse(payload) as unknown);
    return `${JSON.stringify(sanitized)}${hasNewline ? '\n' : ''}`;
  } catch {
    return scrubSecrets(line);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as object | null;
  return prototype === Object.prototype || prototype === null;
}

function sanitizeError(error: Error, memo: WeakMap<object, unknown>): Error {
  const clone = Object.create(Object.getPrototypeOf(error) as object) as Error;
  memo.set(error, clone);

  Object.defineProperty(clone, 'name', {
    value: error.name,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(clone, 'message', {
    value: scrubSecrets(error.message),
    writable: true,
    configurable: true,
  });
  if (typeof error.stack === 'string') {
    Object.defineProperty(clone, 'stack', {
      value: scrubSecrets(error.stack),
      writable: true,
      configurable: true,
    });
  }

  for (const key of Object.keys(error)) {
    (clone as unknown as Record<string, unknown>)[key] = isSensitiveKey(key)
      ? REDACTION_CENSOR
      : redactValue((error as unknown as Record<string, unknown>)[key], memo);
  }

  return clone;
}

/**
 * Recursively redacts sensitive keys and scrubs free-form secrets at any depth.
 * Arrays and plain objects are copied; other objects (dates, streams, class
 * instances) are left untouched so their serializers keep working. A memo
 * maps every original object to its sanitized copy, so an object referenced by
 * more than one field is sanitized once and the sanitized version is reused —
 * never the original — and cycles terminate.
 */
export function redactValue(
  value: unknown,
  memo: WeakMap<object, unknown> = new WeakMap<object, unknown>(),
): unknown {
  if (typeof value === 'string') {
    return scrubSecrets(value);
  }

  if (value instanceof Error) {
    const cached = memo.get(value);
    return cached !== undefined ? cached : sanitizeError(value, memo);
  }

  if (Array.isArray(value)) {
    const cached = memo.get(value);
    if (cached !== undefined) {
      return cached;
    }

    const result: unknown[] = [];
    memo.set(value, result);
    for (const item of value) {
      result.push(redactValue(item, memo));
    }
    return result;
  }

  if (isPlainObject(value)) {
    const cached = memo.get(value);
    if (cached !== undefined) {
      return cached;
    }

    const result: Record<string, unknown> = {};
    memo.set(value, result);
    for (const [key, item] of Object.entries(value)) {
      result[key] = isSensitiveKey(key)
        ? REDACTION_CENSOR
        : redactValue(item, memo);
    }
    return result;
  }

  return value;
}

function accessor(key: string): string {
  return IDENTIFIER_PATTERN.test(key) ? `.${key}` : `["${key}"]`;
}

function nest(prefix: string, key: string): string {
  const segment = accessor(key);
  if (prefix.length === 0) {
    return segment.startsWith('.') ? segment.slice(1) : segment;
  }
  return `${prefix}${segment}`;
}

/**
 * Builds the Pino redaction path list for sensitive fields. This covers values
 * that reach the logger as child bindings, where the recursive log-object
 * sanitation cannot see them. The wildcard `*` matches a single level, so paths
 * are generated for the top level and nested structured fields up to
 * `maxDepth`. Deeper scalar values are still redacted by
 * `scrubSerializedLine`.
 */
export function sensitivePaths(maxDepth = 3): string[] {
  const paths = new Set<string>();

  for (const key of SENSITIVE_ROOT_KEYS) {
    paths.add(nest('', key));
    for (let depth = 1; depth <= maxDepth; depth += 1) {
      const wildcard = Array.from({ length: depth }, () => '*').join('.');
      paths.add(nest(wildcard, key));
    }
    paths.add(nest('req.headers', key));
    paths.add(nest('res.headers', key));
  }

  return [...paths];
}

export function redactionOptions(maxDepth = 3): redactOptions {
  return {
    paths: sensitivePaths(maxDepth),
    censor: REDACTION_CENSOR,
  };
}
