import { describe, expect, it } from 'vitest';

type JsonObject = Record<string, unknown>;

// Auto-discovers every namespace/locale bundle so a new file is covered
// without editing this test.
const modules: Record<string, { default: JsonObject }> = {
  ...import.meta.glob('./common/*.json', { eager: true }),
  ...import.meta.glob('../../features/*/i18n/*.json', { eager: true }),
};

function flatten(
  value: JsonObject,
  prefix = '',
): Array<[key: string, value: string]> {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child !== null && typeof child === 'object' && !Array.isArray(child)) {
      return flatten(child as JsonObject, path);
    }
    return [[path, String(child)] as [string, string]];
  });
}

function namespaceOf(path: string): string {
  if (/common\/[^/]+\.json$/.test(path)) {
    return 'common';
  }
  const feature = /features\/([^/]+)\/i18n\/[^/]+\.json$/.exec(path);
  return feature ? feature[1] : path;
}

function localeOf(path: string): string {
  return (path.split('/').pop() ?? path).replace(/\.json$/, '');
}

const byNamespace = new Map<string, Map<string, Array<[string, string]>>>();
for (const [path, mod] of Object.entries(modules)) {
  const namespace = namespaceOf(path);
  const locale = localeOf(path);
  const locales =
    byNamespace.get(namespace) ?? new Map<string, Array<[string, string]>>();
  locales.set(locale, flatten(mod.default));
  byNamespace.set(namespace, locales);
}

describe('translation resources', () => {
  it('provides es, en and ca for every namespace', () => {
    for (const [namespace, locales] of byNamespace) {
      expect({ namespace, locales: [...locales.keys()].sort() }).toEqual({
        namespace,
        locales: ['ca', 'en', 'es'],
      });
    }
  });

  it('exposes the same keys in every supported locale', () => {
    for (const [namespace, locales] of byNamespace) {
      const reference = locales.get('es') ?? [];
      const referenceKeys = reference.map(([key]) => key).sort();
      for (const locale of ['en', 'ca']) {
        const keys = (locales.get(locale) ?? []).map(([key]) => key).sort();
        const missing = referenceKeys.filter((key) => !keys.includes(key));
        const extra = keys.filter((key) => !referenceKeys.includes(key));
        expect({ namespace, locale, missing, extra }).toEqual({
          namespace,
          locale,
          missing: [],
          extra: [],
        });
      }
    }
  });

  it('has no empty translation value', () => {
    for (const [path, mod] of Object.entries(modules)) {
      const empty = flatten(mod.default)
        .filter(([, value]) => value.trim() === '')
        .map(([key]) => key);
      expect({ path, empty }).toEqual({ path, empty: [] });
    }
  });
});
