import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchSignedInLanguage,
  localizedPath,
  parseLocaleFromPathname,
  resolveInitialLocale,
  resolveLocaleRedirect,
} from './routing';

describe('i18n routing helpers', () => {
  it('builds locale-prefixed paths', () => {
    expect(localizedPath('es', '/')).toBe('/es');
    expect(localizedPath('en', '/login')).toBe('/en/login');
  });

  it('detects an existing locale prefix', () => {
    expect(parseLocaleFromPathname('/ca/settings')).toEqual({
      locale: 'ca',
      pathname: '/settings',
    });
    expect(parseLocaleFromPathname('/login')).toEqual({
      locale: undefined,
      pathname: '/login',
    });
  });

  it('continues a prefix-less route to the chosen locale', () => {
    expect(resolveLocaleRedirect('/login', 'en')).toBe('/en/login');
    expect(resolveLocaleRedirect('/', 'ca')).toBe('/ca');
  });

  it('keeps a supported prefix and rewrites an unsupported one', () => {
    expect(resolveLocaleRedirect('/en/login', 'es')).toBeNull();
    expect(resolveLocaleRedirect('/xx/login', 'es')).toBe('/es/login');
  });
});

describe('resolveInitialLocale', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('reports none for 404 and null for 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 404, ok: false }),
    );
    await expect(fetchSignedInLanguage()).resolves.toBe('none');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 401, ok: false }),
    );
    await expect(fetchSignedInLanguage()).resolves.toBeNull();
  });

  it('brings the URL to the stored language for a signed-in caller', async () => {
    window.history.replaceState(null, '', '/es/settings');
    const replace = vi.spyOn(window.history, 'replaceState');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: () => Promise.resolve({ language: 'en' }),
      }),
    );

    await expect(resolveInitialLocale()).resolves.toBe('en');
    expect(replace).toHaveBeenCalledWith(
      null,
      '',
      expect.stringContaining('/en/settings'),
    );
  });

  it('creates the default language when a signed-in caller has none', async () => {
    window.history.replaceState(null, '', '/');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ status: 404, ok: false })
      .mockResolvedValueOnce({ status: 200, ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolveInitialLocale()).resolves.toBe('en');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [path, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(path).toBe('/users/me/settings');
    expect(init.method).toBe('PATCH');
  });

  it('uses the browser language for an anonymous prefix-less request', async () => {
    window.history.replaceState(null, '', '/');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 401, ok: false }),
    );

    await expect(resolveInitialLocale()).resolves.toBe('en');
  });

  it('defaults to es for an anonymous caller with no supported language', async () => {
    window.history.replaceState(null, '', '/');
    Object.defineProperty(window.navigator, 'languages', {
      value: ['fr'],
      configurable: true,
    });
    Object.defineProperty(window.navigator, 'language', {
      value: 'fr',
      configurable: true,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 401, ok: false }),
    );

    await expect(resolveInitialLocale()).resolves.toBe('es');
  });
});
