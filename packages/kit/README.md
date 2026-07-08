# @repo/kit

Shared building blocks used by every app in the monorepo — identity, paths, AWS clients, logger, HTTP helpers.

## Exports

| Entry | What it is |
|---|---|
| `.` | re-exports from `./identity` + `./paths` (safe for browser + server) |
| `./identity` | `Scope` type, `composeAgentScope`, `s3ScopePath`, `newUuid`, session helpers |
| `./paths` | `METADATA_KEYS`, `rewriteAgentVersion` — S3 metadata contract |
| `./http` / `./http.server` | `fetch` wrappers, error shapes |
| `./logger` / `./logger.server` | pino-based structured logger |
| `./request-context.server` | AsyncLocalStorage request context |
| `./aws` | server-only AWS clients (below) |

## AWS sub-exports

`./aws/s3`, `./aws/bedrock`, `./aws/bedrock-runtime`, `./aws/dynamodb`, `./aws/sigv4`.

Each returns a cached, region-aware SDK client — one place to configure credentials, retry policy, and endpoints. `sigv4` gives you a request signer for calling AgentCore Runtime ARNs directly.

## Split: safe vs `.server`

- Files without `.server` are safe to import from browser code.
- Files ending `.server.ts` pull in Node/AWS SDK and must never be bundled into the client — Vite/Rollup will error if you try.

## Scripts

```bash
pnpm --filter @repo/kit build          # tsc → dist/
pnpm --filter @repo/kit typecheck
```

No tests here — `kit` is a boundary layer; behaviour is exercised by the packages that consume it (`kb`, `registry`, `skills`).
