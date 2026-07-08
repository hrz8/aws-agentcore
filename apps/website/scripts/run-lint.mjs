#!/usr/bin/env node
/*
 * Runs the lint passes serially without short-circuiting, so one failure
 * doesn't hide downstream findings (no PR round-trips for fix-one-then-
 * see-the-next-one). Aggregate exit code = max of all child exits.
 */
import { spawn } from 'node:child_process';
import { exit } from 'node:process';

const PASSES = [
  ['pnpm', ['run', 'lint:styles']],
  ['pnpm', ['run', 'lint:classes']],
];

function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'inherit' });
    child.on('close', (code) => resolve(code ?? 0));
  });
}

const codes = [];
for (const [cmd, args] of PASSES) {
  codes.push(await run(cmd, args));
}
const worst = Math.max(...codes);
exit(worst);
