import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

import { LOCALE_COOKIE } from './src/shared/i18n/constants';

export default defineConfig(() => ({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
      outputStructure: 'message-modules',
      strategy: ['cookie', 'preferredLanguage', 'baseLocale'],
      cookieName: LOCALE_COOKIE,
    }),
    tanstackStart(),
    nitro({
      preset: 'node-server',
      serveStatic: true,
    }),
    viteReact(),
    tailwindcss(),
  ],
}));
