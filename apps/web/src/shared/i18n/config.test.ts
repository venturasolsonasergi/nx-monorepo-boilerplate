import { afterEach, describe, expect, it } from 'vitest';
import i18n from './config';

afterEach(async () => {
  await i18n.changeLanguage('es');
});

describe('i18n config', () => {
  it('aligns the document language with the active locale', async () => {
    await i18n.changeLanguage('ca');
    expect(document.documentElement.lang).toBe('ca');

    await i18n.changeLanguage('en');
    expect(document.documentElement.lang).toBe('en');
  });
});
