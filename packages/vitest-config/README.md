# @repo/vitest-config

Shared vitest presets. Every workspace with tests extends one of these — one file to change for repo-wide test settings.

## Presets

| Entry | Environment |
|---|---|
| `@repo/vitest-config/base` | none — base config only (10 s timeouts, v8 coverage, CI reporter toggle) |
| `@repo/vitest-config/node` | Node — for backend/library tests |
| `@repo/vitest-config/browser` | happy-dom — for React/DOM tests |

## Usage

```ts
// packages/foo/vitest.config.ts
export { default } from '@repo/vitest-config/node';
```

Or extend it:

```ts
import { defineConfig, mergeConfig } from 'vitest/config';
import base from '@repo/vitest-config/node';

export default mergeConfig(base, defineConfig({
  test: { setupFiles: ['./test/setup.ts'] },
}));
```

## Peer deps

`vitest` is a peer; add it to the consuming package. `@vitest/coverage-v8` and `happy-dom` are optional peers — install only if you run coverage or use the browser preset.
