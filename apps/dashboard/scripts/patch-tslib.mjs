import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = new URL('../.output/server/_ssr', import.meta.url).pathname;
const marker = /} = import_tslib\.default\);/g;

let patched = 0;
for (const file of readdirSync(outDir)) {
  if (!file.endsWith('.mjs')) continue;
  const path = join(outDir, file);
  const before = readFileSync(path, 'utf-8');
  if (!marker.test(before)) continue;
  const after = before.replace(marker, '} = import_tslib);');
  writeFileSync(path, after);
  console.log(`[patch-tslib] ${file}`);
  patched++;
}
if (patched === 0) {
  console.log('[patch-tslib] no matches — bundler may have fixed this itself');
}
