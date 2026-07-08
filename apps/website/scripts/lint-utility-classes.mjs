#!/usr/bin/env node
/*
 * Tailwind spacing utility allowlist — ADR-0002 §7.
 *
 * Stylelint can't lint HTML `class=` attributes; this script does that job.
 * Allowed: p|m|gap|space siblings with steps 1..7 (matching our --spacing-N scale).
 * Forbidden: p-8, p-0.5, p-[20px], px-12, gap-10, etc.
 *
 * Usage:  node scripts/lint-utility-classes.mjs "src/**\/*.astro"
 * Exits non-zero on any violation, with file:line and the offending class.
 *
 * Known gaps (intentional — full TS analysis is out of scope):
 *   - Template-literal class names with `${interpolation}` containing `}`
 *     can prematurely close the `class={`...`}` capture.
 *   - Dynamic class names assembled from variables (`p-${size}`) are invisible
 *     to a regex pass — they slip through. Stylelint catches the CSS-side
 *     half; engineers writing `p-${size}` carry the visual-check burden.
 *   - Class attributes split across lines via JSX-like spread (`{...rest}`)
 *     are skipped.
 * The blunt-instrument coverage is intentional: catches the 95% of literal
 * misuse without dragging in an AST parser for two placeholder pages.
 */
import { globSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { argv, exit } from 'node:process';

const SPACING_PREFIXES = [
  'p', 'pt', 'pr', 'pb', 'pl', 'px', 'py',
  'ps', 'pe',
  'm', 'mt', 'mr', 'mb', 'ml', 'mx', 'my',
  'ms', 'me',
  'gap', 'gap-x', 'gap-y',
  'space-x', 'space-y',
];
const ALLOWED_STEPS = new Set(['1', '2', '3', '4', '5', '6', '7']);
// Margin variants accept `auto` (`mx-auto`, `mt-auto`, etc.) — Tailwind's
// margin: auto utility is unrelated to the spacing scale and stays valid.
const MARGIN_PREFIXES = new Set(['m', 'mt', 'mr', 'mb', 'ml', 'mx', 'my', 'ms', 'me']);

const SPACING_RE = new RegExp(
  String.raw`(?:^|[\s:])(-?(?:${SPACING_PREFIXES.join('|')})-(?:[^\s"'\\\`]+))`,
  'g',
);
const CLASS_ATTR_RE = /\bclass(?:Name)?(?::list)?\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g;

function isAllowed(utility) {
  const stripped = utility.replace(/^-/, '');
  const m = stripped.match(/^([a-z-]+)-(.+)$/);
  if (!m) { return false; }
  const [, prefix, value] = m;
  if (!SPACING_PREFIXES.includes(prefix)) { return true; }
  if (MARGIN_PREFIXES.has(prefix) && value === 'auto') { return true; }
  return ALLOWED_STEPS.has(value);
}

function lineOf(source, idx) {
  return source.slice(0, idx).split('\n').length;
}

async function lintFile(path) {
  const src = await readFile(path, 'utf8');
  const violations = [];
  for (const attrMatch of src.matchAll(CLASS_ATTR_RE)) {
    const classes = attrMatch[1] ?? attrMatch[2] ?? attrMatch[3] ?? '';
    const attrStart = attrMatch.index + attrMatch[0].indexOf(classes);
    for (const m of classes.matchAll(SPACING_RE)) {
      const utility = m[1];
      if (isAllowed(utility)) {continue;}
      const absIdx = attrStart + m.index + m[0].indexOf(utility);
      violations.push({ path, line: lineOf(src, absIdx), utility });
    }
  }
  return violations;
}

async function main() {
  const patterns = argv.slice(2);
  if (patterns.length === 0) {
    console.error('usage: lint-utility-classes.mjs <glob> [<glob>...]');
    exit(2);
  }
  const files = patterns.flatMap((p) => globSync(p, { nodir: true }));
  if (files.length === 0) {
    console.error(`no files matched: ${patterns.join(', ')}`);
    exit(0);
  }
  let total = 0;
  for (const file of files) {
    const violations = await lintFile(file);
    for (const v of violations) {
      console.error(
        `${v.path}:${v.line}  off-scale spacing utility "${v.utility}" — only -{1..7} steps allowed (see ADR-0002 §7)`,
      );
      total++;
    }
  }
  if (total > 0) {
    console.error(`\n${total} off-scale spacing utility violation${total === 1 ? '' : 's'}.`);
    exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  exit(2);
});
