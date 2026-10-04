import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, apiClient } from './api-client';

const schema = z.object({ id: z.number() });

const okResponse = (body: unknown) => ({
  ok: true,
  status: 200,
  json: () => body,
});

const errorResponse = (status: number) => ({
  ok: false,
  status,
  json: () => ({}),
});

describe('apiClient', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('parses a valid JSON response', async () => {
    fetchMock.mockResolvedValue(okResponse({ id: 1 }));
    await expect(apiClient.get('/thing', schema)).resolves.toEqual({ id: 1 });
  });

  it('rejects a non-2xx response with an ApiError carrying its status', async () => {
    fetchMock.mockResolvedValue(errorResponse(401));
    await expect(apiClient.get('/thing', schema)).rejects.toBeInstanceOf(
      ApiError,
    );
    await expect(apiClient.get('/thing', schema)).rejects.toMatchObject({
      status: 401,
    });
  });

  it('rejects a payload that does not match the schema', async () => {
    fetchMock.mockResolvedValue(okResponse({ id: 'not-a-number' }));
    await expect(apiClient.get('/thing', schema)).rejects.toThrow();
  });

  it('sends credentials with a JSON body', async () => {
    fetchMock.mockResolvedValue(okResponse({ id: 1 }));
    await apiClient.post('/thing', schema, { name: 'Ana' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/thing',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ name: 'Ana' }),
      }),
    );
  });
});
