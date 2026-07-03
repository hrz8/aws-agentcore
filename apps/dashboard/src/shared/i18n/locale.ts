export type Locale = 'en-US' | 'ms-MY';

export const DEFAULT_LOCALE: Locale = 'en-US';

export const LOCALES: readonly Locale[] = ['en-US', 'ms-MY'] as const;

export const LOCALE_NAMES: Record<Locale, string> = {
  'en-US': 'English',
  'ms-MY': 'Bahasa Malaysia',
};

export function directionFor(_locale: Locale): 'ltr' | 'rtl' {
  return 'ltr';
}

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
}
