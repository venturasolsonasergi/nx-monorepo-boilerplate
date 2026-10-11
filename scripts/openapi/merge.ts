import { parse as parseYaml } from 'yaml';

const REQUIRED_OPENAPI_VERSION = '3.0.3';
const MERGED_INFO = { title: 'Nx Monorepo API', version: '1.0.0' } as const;
const MERGED_SERVERS = [{ url: '/' }] as const;

const COMPONENT_CATEGORIES = [
  'schemas',
  'responses',
  'parameters',
  'examples',
  'requestBodies',
  'headers',
  'securitySchemes',
  'links',
  'callbacks',
] as const;

const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const;

export type JsonObject = Record<string, unknown>;

export interface ServiceContract {
  name: string;
  document: JsonObject;
}

interface ServiceInfo {
  title: string;
  version: string;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function escapeJsonPointerToken(token: string): string {
  return token.replace(/~/g, '~0').replace(/\//g, '~1');
}

function unescapeJsonPointerToken(token: string): string {
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

/**
 * Parses and validates a single service contract. Kept free of filesystem and
 * runtime coupling so the merge can be unit tested in isolation.
 */
export function parseContractText(name: string, text: string): ServiceContract {
  const document = parseYaml(text) as unknown;

  if (!isObject(document)) {
    throw new Error(`[${name}] OpenAPI contract did not parse to an object`);
  }

  if (document.openapi !== REQUIRED_OPENAPI_VERSION) {
    throw new Error(
      `[${name}] Expected OpenAPI ${REQUIRED_OPENAPI_VERSION}, found ${String(
        document.openapi,
      )}`,
    );
  }

  return { name, document };
}

function readServiceInfo(contract: ServiceContract): ServiceInfo {
  const info = contract.document.info;
  if (!isObject(info) || typeof info.version !== 'string') {
    throw new Error(`[${contract.name}] Missing info.version`);
  }

  return {
    title: typeof info.title === 'string' ? info.title : contract.name,
    version: info.version,
  };
}

function componentsOf(document: JsonObject): JsonObject {
  const components = document.components;
  return isObject(components) ? components : {};
}

/**
 * A component name declared by more than one service collides, scoped per
 * component category. Every declaring service receives the same
 * service-prefixed rename, so the result never depends on service order.
 */
function collectCollisions(
  contracts: ServiceContract[],
): Map<string, Set<string>> {
  const declaringServices = new Map<string, Set<string>>();

  for (const { name, document } of contracts) {
    const components = componentsOf(document);
    for (const category of COMPONENT_CATEGORIES) {
      const entries = components[category];
      if (!isObject(entries)) {
        continue;
      }
      for (const componentName of Object.keys(entries)) {
        const key = `${category}\u0000${componentName}`;
        const services = declaringServices.get(key) ?? new Set<string>();
        services.add(name);
        declaringServices.set(key, services);
      }
    }
  }

  const collisions = new Map<string, Set<string>>();
  for (const [key, services] of declaringServices) {
    if (services.size < 2) {
      continue;
    }
    const [category, componentName] = key.split('\u0000');
    const names = collisions.get(category) ?? new Set<string>();
    names.add(componentName);
    collisions.set(category, names);
  }

  return collisions;
}

function renamedComponent(
  service: string,
  category: string,
  componentName: string,
  collisions: Map<string, Set<string>>,
): string {
  return collisions.get(category)?.has(componentName)
    ? `${service}_${componentName}`
    : componentName;
}

function refTarget(
  ref: string,
): { category: string; name: string } | undefined {
  const match = /^#\/components\/([^/]+)\/(.+)$/.exec(ref);
  if (!match) {
    return undefined;
  }

  return {
    category: unescapeJsonPointerToken(match[1]),
    name: unescapeJsonPointerToken(match[2]),
  };
}

function rewriteRefs(
  node: unknown,
  service: string,
  collisions: Map<string, Set<string>>,
): unknown {
  if (Array.isArray(node)) {
    return node.map((entry) => rewriteRefs(entry, service, collisions));
  }

  if (!isObject(node)) {
    return node;
  }

  const result: JsonObject = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === '$ref' && typeof value === 'string') {
      const target = refTarget(value);
      if (target) {
        const renamed = renamedComponent(
          service,
          target.category,
          target.name,
          collisions,
        );
        result[key] = `#/components/${escapeJsonPointerToken(
          target.category,
        )}/${escapeJsonPointerToken(renamed)}`;
        continue;
      }
    }

    result[key] = rewriteRefs(value, service, collisions);
  }

  return result;
}

function rewriteSecurityRequirements(
  security: unknown,
  schemeRenames: Map<string, string>,
): unknown {
  if (!Array.isArray(security)) {
    return security;
  }

  return security.map((requirement: unknown) => {
    if (!isObject(requirement)) {
      return requirement;
    }
    const rewritten: JsonObject = {};
    for (const [scheme, scopes] of Object.entries(requirement)) {
      rewritten[schemeRenames.get(scheme) ?? scheme] = scopes;
    }
    return rewritten;
  });
}

/**
 * Security schemes are referenced by name inside `security` requirement lists
 * rather than by `$ref`, so colliding scheme names must also be rewritten
 * there.
 */
function securitySchemeRenames(
  contract: ServiceContract,
  collisions: Map<string, Set<string>>,
): Map<string, string> {
  const entries = componentsOf(contract.document).securitySchemes;
  const renames = new Map<string, string>();

  if (!isObject(entries)) {
    return renames;
  }

  for (const componentName of Object.keys(entries)) {
    const renamed = renamedComponent(
      contract.name,
      'securitySchemes',
      componentName,
      collisions,
    );
    if (renamed !== componentName) {
      renames.set(componentName, renamed);
    }
  }

  return renames;
}

function mergePaths(
  contract: ServiceContract,
  collisions: Map<string, Set<string>>,
): JsonObject {
  const { document, name } = contract;
  const paths = document.paths;
  if (!isObject(paths)) {
    throw new Error(`[${name}] Missing paths object`);
  }

  const schemeRenames = securitySchemeRenames(contract, collisions);
  const mergedPaths: JsonObject = {};

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!isObject(pathItem)) {
      mergedPaths[path] = pathItem;
      continue;
    }

    const mergedPathItem: JsonObject = { ...pathItem };
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!isObject(operation)) {
        continue;
      }

      const existingTags = Array.isArray(operation.tags)
        ? operation.tags.filter(
            (tag): tag is string => typeof tag === 'string' && tag !== name,
          )
        : [];

      const tagged: JsonObject = {
        ...operation,
        tags: [name, ...existingTags],
      };

      if (schemeRenames.size > 0 && 'security' in operation) {
        tagged.security = rewriteSecurityRequirements(
          operation.security,
          schemeRenames,
        );
      }

      mergedPathItem[method] = tagged;
    }

    mergedPaths[path] = rewriteRefs(mergedPathItem, name, collisions);
  }

  return mergedPaths;
}

function mergeComponents(
  contract: ServiceContract,
  collisions: Map<string, Set<string>>,
): JsonObject {
  const { document, name } = contract;
  const components = componentsOf(document);
  const merged: JsonObject = {};

  for (const category of COMPONENT_CATEGORIES) {
    const entries = components[category];
    if (!isObject(entries)) {
      continue;
    }

    const categoryEntries: JsonObject = {};
    for (const [componentName, value] of Object.entries(entries)) {
      const newName = renamedComponent(
        name,
        category,
        componentName,
        collisions,
      );
      if (newName in categoryEntries) {
        throw new Error(
          `[${name}] Duplicate component name after prefixing: ${newName}`,
        );
      }
      categoryEntries[newName] = rewriteRefs(value, name, collisions);
    }

    merged[category] = categoryEntries;
  }

  return merged;
}

export function mergeContracts(contracts: ServiceContract[]): JsonObject {
  const collisions = collectCollisions(contracts);

  const mergedPaths: JsonObject = {};
  const mergedComponents: JsonObject = {};

  for (const contract of contracts) {
    const paths = mergePaths(contract, collisions);
    for (const [path, pathItem] of Object.entries(paths)) {
      if (path in mergedPaths) {
        throw new Error(
          `Path collision: '${path}' is declared by multiple services`,
        );
      }
      mergedPaths[path] = pathItem;
    }

    const components = mergeComponents(contract, collisions);
    for (const [category, entries] of Object.entries(components)) {
      const target = (mergedComponents[category] ??= {}) as JsonObject;
      for (const [componentName, value] of Object.entries(
        entries as JsonObject,
      )) {
        if (componentName in target) {
          throw new Error(
            `Component collision in ${category}: '${componentName}' is declared by multiple services`,
          );
        }
        target[componentName] = value;
      }
    }
  }

  const tags = contracts.map((contract) => {
    const info = readServiceInfo(contract);
    return {
      name: contract.name,
      description: `${info.title} (version ${info.version})`,
    };
  });

  return {
    openapi: REQUIRED_OPENAPI_VERSION,
    info: { ...MERGED_INFO },
    servers: MERGED_SERVERS.map((server) => ({ ...server })),
    tags,
    paths: mergedPaths,
    components: mergedComponents,
  };
}

export function serializeContract(document: JsonObject): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}
