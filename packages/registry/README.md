# @repo/registry

Registry of tenants, agents, MCP servers, and vars. Single source of truth for "what agents exist and how are they configured". Consumed by `apps/agent`, `apps/middleware`, and `apps/dashboard`.

## Exports

| Entry | What it is |
|---|---|
| `.` | domain types, zod schemas, `resolveAgentWithLive`, model catalogs |
| `./domain` | domain types + schemas |
| `./interface` | repository interfaces (below) |
| `./errors` | typed errors |
| `./s3-yaml` | `S3YamlRegistryRepository` — YAML in S3 (`UPLOADS_BUCKET`) |
| `./local-yaml` | `LocalYamlRegistryRepository` — YAML on disk (offline dev) |
| `./postgres` | `PostgresRegistryRepository` — Postgres (schema in `src/adapters/database/`) |

## Interfaces

```ts
interface RegistryRepository {
  tenants:      TenantRepository;
  agents:       AgentRepository;      // list, get, branch, updateFields, setEnabled
  mcpServers:   McpServerRepository;
  vars:         VarRepository;        // per-tenant variables ({{ vars.KEY }} templating)
  builtinTools: BuiltinToolRepository;
  rawText:      RawTextEditable | null;   // dashboard's YAML editor — only present for YAML adapters
  refresh(): Promise<void>;
}
```

## Live alias

`version: 'live'` resolves to whichever concrete version has `enabled: true` — see `resolveAgentWithLive` and `LIVE_VERSION_ALIAS`.

## Var templating

Agent configs reference tenant vars as `"{{ vars.OPENAI_KEY }}"`. `extractVarRefs` and `assertVarRefSyntax` are the validators; the agent runtime resolves them at boot.

## Scripts

```bash
pnpm --filter @repo/registry build       # tsc → dist/
pnpm --filter @repo/registry test        # vitest
pnpm --filter @repo/registry typecheck
```
