// Empty by default so requests stay same-origin and use the Vite dev proxy
// (`/auth`, `/users`, `/orders` -> the API). Set VITE_API_URL for other hosts.
const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// A definitive "not authenticated" answer is a 401. Any other failure
// (network, 5xx, schema mismatch) is unknown and must not be read as signed out.
export function isUnauthenticatedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

interface ZodLikeSchema<T> {
  parse: (data: unknown) => T;
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

async function request<T>(
  path: string,
  schema: ZodLikeSchema<T>,
  options: RequestOptions = {},
): Promise<T> {
  const { body, headers, ...rest } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new ApiError(
      response.status,
      `Request to ${path} failed with status ${response.status}`,
    );
  }

  const data: unknown = await response.json();
  // Every response is validated before it reaches any feature/UI code.
  return schema.parse(data);
}

export const apiClient = {
  get: <T>(path: string, schema: ZodLikeSchema<T>) =>
    request(path, schema, { method: 'GET' }),
  post: <T>(path: string, schema: ZodLikeSchema<T>, body: unknown) =>
    request(path, schema, { method: 'POST', body }),
};
