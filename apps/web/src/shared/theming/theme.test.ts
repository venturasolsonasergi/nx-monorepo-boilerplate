import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  THEME_STORAGE_KEY,
  applyTheme,
  isThemePreference,
  readCachedTheme,
  resolveTheme,
  writeCachedTheme,
} from './theme';

function mockMatchMedia(dark: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: dark && query === '(prefers-color-scheme: dark)',
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe('theme storage and resolution', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads a cached dark preference', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(readCachedTheme()).toBe('dark');
  });

  it('returns null when no preference is cached', () => {
    expect(readCachedTheme()).toBeNull();
  });

  it('returns null for an invalid cached value', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    expect(readCachedTheme()).toBeNull();
  });

  it('persists a preference through writeCachedTheme', () => {
    writeCachedTheme('system');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
  });

  it('resolves an explicit preference without consulting the OS', () => {
    mockMatchMedia(true);
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('resolves system and null through the OS scheme', () => {
    mockMatchMedia(true);
    expect(resolveTheme('system')).toBe('dark');
    expect(resolveTheme(null)).toBe('dark');
  });

  it('applies and removes the dark class', () => {
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('validates theme preferences', () => {
    expect(isThemePreference('system')).toBe(true);
    expect(isThemePreference('sepia')).toBe(false);
    expect(isThemePreference(undefined)).toBe(false);
  });
});
