import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import commonEs from './common/es.json';
import commonEn from './common/en.json';
import commonCa from './common/ca.json';
import authEs from '../../features/auth/i18n/es.json';
import authEn from '../../features/auth/i18n/en.json';
import authCa from '../../features/auth/i18n/ca.json';
import landingEs from '../../features/landing/i18n/es.json';
import landingEn from '../../features/landing/i18n/en.json';
import landingCa from '../../features/landing/i18n/ca.json';
import dashboardEs from '../../features/dashboard/i18n/es.json';
import dashboardEn from '../../features/dashboard/i18n/en.json';
import dashboardCa from '../../features/dashboard/i18n/ca.json';
import settingsEs from '../../features/settings/i18n/es.json';
import settingsEn from '../../features/settings/i18n/en.json';
import settingsCa from '../../features/settings/i18n/ca.json';

export const SUPPORTED_LOCALES = ['es', 'en', 'ca'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'es';
export const DEFAULT_USER_LANGUAGE: Locale = 'en';

export function isSupportedLocale(
  value: string | undefined | null,
): value is Locale {
  return (
    typeof value === 'string' &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

export function baseLanguage(value: string): string {
  return value.toLowerCase().split('-')[0];
}

export function detectPreferredLocale(): Locale {
  const candidates =
    typeof navigator !== 'undefined'
      ? (navigator.languages ?? [navigator.language])
      : [];
  for (const c of candidates) {
    const b = baseLanguage(c);
    if (isSupportedLocale(b)) return b;
  }
  return DEFAULT_LOCALE;
}

void i18n.use(initReactI18next).init({
  resources: {
    es: {
      common: commonEs,
      auth: authEs,
      landing: landingEs,
      dashboard: dashboardEs,
      settings: settingsEs,
    },
    en: {
      common: commonEn,
      auth: authEn,
      landing: landingEn,
      dashboard: dashboardEn,
      settings: settingsEn,
    },
    ca: {
      common: commonCa,
      auth: authCa,
      landing: landingCa,
      dashboard: dashboardCa,
      settings: settingsCa,
    },
  },
  lng: DEFAULT_LOCALE,
  fallbackLng: {
    es: ['es'],
    en: ['en'],
    ca: ['ca'],
    default: [DEFAULT_LOCALE],
  },
  supportedLngs: SUPPORTED_LOCALES,
  defaultNS: 'common',
  ns: ['common', 'auth', 'landing', 'dashboard', 'settings'],
  interpolation: { escapeValue: false },
  returnNull: false,
});

i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined' && lng) {
    document.documentElement.lang = baseLanguage(lng);
  }
});

export default i18n;
