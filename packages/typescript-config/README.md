# @repo/typescript-config

Shared `tsconfig.json` presets for the monorepo. Every workspace extends one of these — one file to change for repo-wide compiler settings.

## Presets

| File | Use for |
|---|---|
| `base.json` | `strict`, ES2022, NodeNext ESM, `noUncheckedIndexedAccess` — safe default for any package |
| `node.json` | Node-only apps + libraries — `types: ["node"]`, source maps, decl off |
| `react-library.json` | Extends `base.json` with `jsx: react-jsx` |
| `tanstack.json` | TanStack Start apps — `moduleResolution: bundler`, `noEmit`, JSX on |
| `astro.json` | Extends `astro/tsconfigs/strict` |

## Usage

```json
// packages/foo/tsconfig.json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src/**/*"]
}
```

No build step — the JSON files are consumed directly by `tsc`.
