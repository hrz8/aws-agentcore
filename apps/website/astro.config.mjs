import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, envField, fontProviders } from 'astro/config';

/*
 * Build-time gate for the dev/preview Showcase Surface (/internal/design-tokens).
 * The page's frontmatter already returns 404 when INCLUDE_DESIGN_TOKENS !== '1',
 * but Astro still emits a 404.html at that path — i.e. dist/internal/ leaks.
 * This integration prunes it after build when the flag is absent so prod
 * artifacts contain no trace of the surface. See ADR-0002 §8.
 */
const internalSurfaceGate = {
  name: 'twai:design-tokens-gate',
  hooks: {
    'astro:build:done': async ({ dir, logger }) => {
      if (process.env.INCLUDE_DESIGN_TOKENS === '1') {
        return;
      }
      const internalDir = new URL('internal/', dir);
      await rm(fileURLToPath(internalDir), { recursive: true, force: true });
      logger.info('Pruned dist/internal/ — INCLUDE_DESIGN_TOKENS not set.');
    },
  },
};

export default defineConfig({
  site: 'https://nd8.ai',
  env: {
    schema: {
      // "1" includes the /internal/design-tokens Showcase Surface in the build;
      // anything else excludes it. Default-on in dev via .env.development;
      // set in CI for Dev Stage builds; LEAVE UNSET for production. See ADR-0002 §8.
      // `access: 'public'` — this is a build-shape flag, not a secret.
      INCLUDE_DESIGN_TOKENS: envField.string({
        context: 'server',
        access: 'public',
        optional: true,
      }),
    },
  },
  i18n: {
    defaultLocale: 'en-GB',
    locales: [
      'en-GB',
      { path: 'ms', codes: ['ms-MY'] },
    ],
    routing: {
      prefixDefaultLocale: false,
      fallbackType: 'rewrite',
    },
    fallback: {
      ms: 'en-GB',
    },
  },
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Sora',
      cssVariable: '--font-sora',
      weights: [400],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext'],
    },
    {
      provider: fontProviders.google(),
      name: 'Syne',
      cssVariable: '--font-syne',
      weights: [600],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext'],
    },
  ],
  integrations: [mdx(), internalSurfaceGate],
  vite: {
    plugins: [tailwindcss()],
  },
});
