# @repo/skills

Skill packages — install / list / read / delete Claude-style skills (SKILL.md + resources), backed by S3. Consumed by `apps/agent` (loading skills at boot) and `apps/dashboard` (management UI).

## Exports

| Entry | What it is |
|---|---|
| `.` | `SkillsRepository` interface + domain types |
| `./domain` | domain types (`SkillSummary`, `SkillDetail`, `SkillContent`, `SkillSource`) |
| `./interface` | `SkillsRepository`, input types |
| `./errors` | typed errors |
| `./adapters/s3` | `S3SkillsRepository` — production adapter |
| `./adapters/memory` | in-memory adapter for tests |
| `./format` | zip parsing, SKILL.md front-matter validation |
| `./testing` | shared contract tests |

## Shape

```ts
import { S3SkillsRepository } from '@repo/skills/adapters/s3';

const skills = new S3SkillsRepository({ /* bucket, region, ... */ });

await skills.install(scope, { kind: 'zip',       data: buffer });
await skills.install(scope, { kind: 'skill-md',  name: 'weather', skillMd: '...' });

const list   = await skills.list(scope);
const detail = await skills.get(scope, 'weather');            // metadata + resources
const body   = await skills.getContent(scope, 'weather');     // SKILL.md text
const url    = await skills.signResource({ scope, name: 'weather', path: 'assets/wind.png' });
await skills.remove(scope, 'weather');
```

Scope = `{ tenantId, agentId, version }` from `@repo/kit/identity`.

## Skill layout

Each installed skill lives at `s3://<bucket>/<scope-path>/skills/<name>/`:
```
SKILL.md               # required — YAML front-matter + markdown body
<any-resource-files>   # optional — referenced from SKILL.md, served via signResource
```

`branch(scope, toVersion)` copies every skill under a scope to a new version prefix — used when the dashboard branches an agent version.

## Scripts

```bash
pnpm --filter @repo/skills build          # tsc → dist/
pnpm --filter @repo/skills test           # vitest (contract suite runs both adapters)
pnpm --filter @repo/skills typecheck
```
