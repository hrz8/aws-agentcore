/*
 * Locale-routing helpers — canonical home for cross-component routing logic
 * consumed by Header, Footer, LanguageSwitcher, and future page Epics.
 * See ADR-0005 §3 for the locale-stripped active-route convention and the
 * permanently-EN technical-surface list (`isEnOnlyPath`).
 *
 * URL convention: EN paths are unprefixed (`/use-cases`); MS paths carry an
 * `/ms` segment prefix (`/ms/use-cases`). Locale tags follow IETF format
 * (`en-GB`, `ms-MY`) and match Astro's `currentLocale` output — keep the
 * type aligned with `astro.config.mjs` i18n.locales.
 */

export type Locale = 'en-GB' | 'ms-MY';

const MS_PREFIX = '/ms';
const EN_ONLY_PREFIXES = ['/developers', '/comparison', '/glossary'] as const;

/**
 * Build a locale-prefixed href for `path` (which is expected to be a
 * locale-free, absolute path starting with `/`).
 *
 *   localeHref('/use-cases', 'en-GB') → '/use-cases'
 *   localeHref('/use-cases', 'ms-MY') → '/ms/use-cases'
 *   localeHref('/',          'ms-MY') → '/ms/'
 */
export function localeHref(path: string, locale: Locale): string {
  if (locale === 'en-GB') {
    return path;
  }
  if (path === '/') {
    return `${MS_PREFIX}/`;
  }
  return `${MS_PREFIX}${path}`;
}

/**
 * Canonicalise a pathname to its locale-free form.
 *
 *   stripLocale('/ms/use-cases') → '/use-cases'
 *   stripLocale('/ms')           → '/'
 *   stripLocale('/ms/')          → '/'
 *   stripLocale('/use-cases')    → '/use-cases'
 */
export function stripLocale(pathname: string): string {
  if (pathname === MS_PREFIX || pathname === `${MS_PREFIX}/`) {
    return '/';
  }
  if (pathname.startsWith(`${MS_PREFIX}/`)) {
    return pathname.slice(MS_PREFIX.length);
  }
  return pathname;
}

/**
 * True for permanently-EN technical surfaces per Design Brief §IA — the
 * `/developers`, `/comparison`, `/glossary` trees and their nested paths.
 * Accepts either locale-prefixed or locale-free input.
 */
export function isEnOnlyPath(pathname: string): boolean {
  const normalized = stripLocale(pathname);
  return EN_ONLY_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

/**
 * Build-time active-route match consumed by Header to compute
 * `aria-current="page"`. Locale-stripped prefix-match; `/` requires an exact
 * match so the home link doesn't claim every page as active.
 */
export function isActive(linkHref: string, currentPathname: string): boolean {
  const normalized = stripLocale(currentPathname);
  if (linkHref === '/') {
    return normalized === '/';
  }
  return normalized === linkHref || normalized.startsWith(`${linkHref}/`);
}
