import {
  mergeContracts,
  parseContractText,
  serializeContract,
  type JsonObject,
  type ServiceContract,
} from './merge';

function contract(document: JsonObject): ServiceContract {
  return { name: String(document['x-test-service']), document };
}

function asObject(value: unknown): JsonObject {
  return value as JsonObject;
}

function operation(
  merged: JsonObject,
  path: string,
  method: string,
): JsonObject {
  return asObject(asObject(merged['paths'])[path])[method] as JsonObject;
}

function baseDocument(
  service: string,
  overrides: Partial<JsonObject> = {},
): JsonObject {
  return {
    openapi: '3.0.3',
    info: { title: `${service} API`, version: '1.0.0' },
    'x-test-service': service,
    paths: {},
    ...overrides,
  };
}

describe('mergeContracts', () => {
  describe('tag injection', () => {
    it('tags every operation with its owning service and preserves existing tags after it', () => {
      const auth = contract(
        baseDocument('auth', {
          paths: {
            '/auth/login': {
              post: {
                operationId: 'authLogin',
                tags: ['legacy'],
                responses: {},
              },
            },
            '/auth/logout': {
              post: { operationId: 'authLogout', responses: {} },
            },
          },
        }),
      );

      const merged = mergeContracts([auth]);

      expect(operation(merged, '/auth/login', 'post').tags).toEqual([
        'auth',
        'legacy',
      ]);
      expect(operation(merged, '/auth/logout', 'post').tags).toEqual(['auth']);
    });

    it('declares a top-level tag per service carrying the service version', () => {
      const merged = mergeContracts([contract(baseDocument('auth'))]);

      expect(merged.tags).toEqual([
        { name: 'auth', description: 'auth API (version 1.0.0)' },
      ]);
    });
  });

  describe('component collision prefixing', () => {
    const auth = contract(
      baseDocument('auth', {
        paths: {
          '/auth/x': {
            get: {
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Shared' },
                    },
                  },
                },
              },
            },
          },
        },
        components: {
          schemas: {
            Shared: { type: 'object' },
            OnlyAuth: { type: 'string' },
            Container: {
              type: 'array',
              items: { $ref: '#/components/schemas/Shared' },
            },
          },
        },
      }),
    );

    const users = contract(
      baseDocument('users', {
        paths: {
          '/users/x': {
            get: {
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Shared' },
                    },
                  },
                },
              },
            },
          },
        },
        components: {
          schemas: {
            Shared: { type: 'number' },
            OnlyUsers: { type: 'boolean' },
          },
        },
      }),
    );

    const merged = mergeContracts([auth, users]);
    const schemas = asObject(merged.components)['schemas'] as JsonObject;

    it('prefixes a colliding name for every declaring service', () => {
      expect(schemas['auth_Shared']).toEqual({ type: 'object' });
      expect(schemas['users_Shared']).toEqual({ type: 'number' });
      expect(schemas['Shared']).toBeUndefined();
    });

    it('rewrites $ref usages in operations to the prefixed name', () => {
      const authRef = asObject(
        asObject(
          asObject(
            asObject(operation(merged, '/auth/x', 'get').responses)['200'],
          )['content'],
        )['application/json'],
      )['schema'] as JsonObject;
      const usersRef = asObject(
        asObject(
          asObject(
            asObject(operation(merged, '/users/x', 'get').responses)['200'],
          )['content'],
        )['application/json'],
      )['schema'] as JsonObject;

      expect(authRef.$ref).toBe('#/components/schemas/auth_Shared');
      expect(usersRef.$ref).toBe('#/components/schemas/users_Shared');
    });

    it('rewrites $ref usages nested inside component definitions', () => {
      expect(asObject(schemas['Container']).items).toEqual({
        $ref: '#/components/schemas/auth_Shared',
      });
    });

    it('preserves unique component names unchanged', () => {
      expect(schemas['OnlyAuth']).toEqual({ type: 'string' });
      expect(schemas['OnlyUsers']).toEqual({ type: 'boolean' });
      expect(schemas['Container']).toEqual({
        type: 'array',
        items: { $ref: '#/components/schemas/auth_Shared' },
      });
    });

    it('rewrites colliding security schemes in both definitions and operations', () => {
      const scheme = (name: string): ServiceContract =>
        contract(
          baseDocument(name, {
            paths: {
              [`/${name}/k`]: {
                get: {
                  security: [{ sessionCookie: [] }],
                  responses: {},
                },
              },
            },
            components: {
              securitySchemes: {
                sessionCookie: {
                  type: 'apiKey',
                  in: 'cookie',
                  name: `${name}-cookie`,
                },
              },
            },
          }),
        );

      const result = mergeContracts([scheme('auth'), scheme('users')]);

      expect(asObject(result.components)['securitySchemes']).toEqual({
        auth_sessionCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: 'auth-cookie',
        },
        users_sessionCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: 'users-cookie',
        },
      });
      expect(operation(result, '/auth/k', 'get').security).toEqual([
        { auth_sessionCookie: [] },
      ]);
      expect(operation(result, '/users/k', 'get').security).toEqual([
        { users_sessionCookie: [] },
      ]);
    });
  });

  describe('merged document shape', () => {
    it('collapses servers to a single online origin and uses a generic info block', () => {
      const merged = mergeContracts([
        contract(baseDocument('auth')),
        contract(baseDocument('users')),
      ]);

      expect(merged.servers).toEqual([{ url: '/' }]);
      expect(merged.info).toEqual({
        title: 'Nx Monorepo API',
        version: '1.0.0',
      });
      expect(merged.openapi).toBe('3.0.3');
    });
  });

  describe('determinism', () => {
    it('produces byte-identical output for identical source contracts', () => {
      const build = (): ServiceContract[] => [
        contract(
          baseDocument('auth', {
            paths: { '/auth/a': { get: { responses: {} } } },
            components: { schemas: { Shared: { type: 'object' } } },
          }),
        ),
        contract(
          baseDocument('users', {
            paths: { '/users/a': { get: { responses: {} } } },
            components: { schemas: { Shared: { type: 'number' } } },
          }),
        ),
      ];

      const first = serializeContract(mergeContracts(build()));
      const second = serializeContract(mergeContracts(build()));

      expect(first).toBe(second);
    });
  });

  describe('parseContractText', () => {
    it('accepts an OpenAPI 3.0.3 document', () => {
      const parsed = parseContractText(
        'auth',
        JSON.stringify(baseDocument('auth')),
      );
      expect(parsed.document.openapi).toBe('3.0.3');
    });

    it('fails loudly on a non-3.0.3 document', () => {
      expect(() =>
        parseContractText(
          'auth',
          JSON.stringify({
            openapi: '3.1.0',
            info: { title: 'x', version: '1' },
            paths: {},
          }),
        ),
      ).toThrow('Expected OpenAPI 3.0.3');
    });
  });
});
