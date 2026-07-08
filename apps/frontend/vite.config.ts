import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const isWidgetMin = mode === 'widget';
  const isWidgetUnmin = mode === 'widget-unmin';
  const isWidget = isWidgetMin || isWidgetUnmin;

  if (!isWidget) {
    return {
      plugins: [react()],
      server: { port: 3456 },
    };
  }

  const outFile = isWidgetMin ? 'widget.min.js' : 'widget.js';
  const emptyStub = resolve(__dirname, 'src/widget/shims/empty.ts');
  const emptyCssStub = resolve(__dirname, 'src/widget/shims/empty.css');
  const streamdownStub = resolve(__dirname, 'src/widget/shims/streamdown.tsx');

  return {
    plugins: [react()],
    resolve: {
      alias: [
        { find: /^streamdown$/, replacement: streamdownStub },
        { find: /^shiki$/, replacement: emptyStub },
        { find: /^shiki\/.*/, replacement: emptyStub },
        { find: /^@shikijs\/.*/, replacement: emptyStub },
        { find: /^mermaid$/, replacement: emptyStub },
        { find: /^mermaid\/.*/, replacement: emptyStub },
        { find: /^katex\/dist\/katex\.min\.css$/, replacement: emptyCssStub },
      ],
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env': '({})',
    },
    build: {
      // Emit directly into the public-files bucket-mirror layout. min-mode
      // (which runs first per package.json) wipes the dir; unmin adds alongside.
      outDir: resolve(__dirname, '..', 'public-files', 'libs', 'chat-widget', 'latest'),
      emptyOutDir: isWidgetMin,
      cssCodeSplit: false,
      minify: isWidgetMin,
      sourcemap: !isWidgetMin,
      lib: {
        entry: resolve(__dirname, 'src/widget/embed.tsx'),
        name: 'nd8',
        formats: ['iife'],
        fileName: () => outFile,
      },
      rollupOptions: {
        external: [],
        output: {
          inlineDynamicImports: true,
          entryFileNames: outFile,
        },
      },
    },
  };
});
