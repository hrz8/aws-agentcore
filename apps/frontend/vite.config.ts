import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, type PluginOption } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Mirrors widget.min.js/widget.js under the CDN's URL path so a static
// server rooted at dist-widget/ resolves absolute paths the same way.
function cdnLayoutMirror(fileName: string): PluginOption {
  return {
    name: 'nd8-cdn-layout-mirror',
    apply: 'build',
    closeBundle() {
      const outDir = resolve(__dirname, 'dist-widget');
      const nestedDir = resolve(outDir, 'libs/chat-widget/latest');
      const src = resolve(outDir, fileName);
      if (!existsSync(src)) return;
      mkdirSync(nestedDir, { recursive: true });
      copyFileSync(src, resolve(nestedDir, fileName));
    },
  };
}

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
    plugins: [react(), cdnLayoutMirror(outFile)],
    publicDir: resolve(__dirname, 'widget-public'),
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
      outDir: 'dist-widget',
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
