import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'lambda');

async function buildLambda() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  // splitting=true isolates dynamic imports into chunks — required so the SQLite
  // branch's top-level `better-sqlite3` import doesn't resolve at Lambda cold start.
  const result = await build({
    entryPoints: [resolve(ROOT, 'src/main.ts')],
    outdir: OUT,
    outExtension: { '.js': '.mjs' },
    entryNames: 'index',
    chunkNames: 'chunks/[name]-[hash]',
    bundle: true,
    splitting: true,
    minify: true,
    sourcemap: true,
    platform: 'node',
    target: 'node24',
    format: 'esm',
    // Shims for CJS deps reaching for require / __dirname / __filename in ESM output.
    banner: {
      js: [
        'import { createRequire as __createRequire } from \'node:module\';',
        'import { fileURLToPath as __fileURLToPath } from \'node:url\';',
        'import { dirname as __dirname_fn } from \'node:path\';',
        'const require = __createRequire(import.meta.url);',
        'const __filename = __fileURLToPath(import.meta.url);',
        'const __dirname = __dirname_fn(__filename);',
      ].join(''),
    },
    external: ['better-sqlite3'],
    logLevel: 'info',
    metafile: true,
  });

  const { writeFile } = await import('node:fs/promises');
  await writeFile(resolve(OUT, 'meta.json'), JSON.stringify(result.metafile, null, 2));
  console.info(`[build-lambda] wrote ${OUT}/ (entry: index.mjs, chunks: chunks/)`);
}

buildLambda().catch((err) => {
  console.error('[build-lambda] failed:', err);
  process.exit(1);
});
