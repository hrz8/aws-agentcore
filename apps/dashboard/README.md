# @agentcore/dashboard

TanStack Start (SSR) admin platform for AgentCore — KB / web / skill management,
scoped by tenant + agent + version. Sibling to `apps/chat` (the end-user chat
SPA, formerly `frontend/`) and to `middleware` (the invoker + admin API today).

## Stack

- **TanStack Start 1.168** + **TanStack Router 1.170** + **TanStack Query 5.101**
- **Vite 8** with **`@tanstack/react-start/plugin/vite`** + **nitro** aws-lambda (streaming)
- **React 19.2** (SSR + hydration)
- **Tailwind v4** + **shadcn** (Savanna theme, dark by default) + **lucide-react** icons
- **inlang paraglide 2.20** — English (en-US) only for now
- **CodeMirror 6** — YAML editor for the debug drawer

Node **24**, pnpm **10.34** (with `minimumReleaseAge: 4320` — 3-day cooling-off
enforced repo-wide from `pnpm-workspace.yaml`).

## Scripts

```bash
nvm use 24
pnpm dev        # http://localhost:8765
pnpm build      # nitro aws-lambda preset → .output/server (Lambda handler) + .output/public (static assets)
pnpm typecheck  # tsc --noEmit
```

Deployment: see [`infra/`](../../infra/) — CDK stack packages `.output/server` as a Lambda + uploads `.output/public` to S3 behind CloudFront.

## Configuration

Copy `.env.example` → `.env` and set:

- `MIDDLEWARE_URL` — where the dashboard proxies admin calls (server-side).
- `VITE_MIDDLEWARE_URL` — same URL on the client for direct fetches (KB/skill
  uploads use presigned S3 URLs and must originate in the browser).
- `VITE_TENANT_ID`, `VITE_TENANT_SLUG` — single-tenant deployment scope.

## Routes

| path                                | purpose                                     |
| ----------------------------------- | ------------------------------------------- |
| `/`                                 | redirects to `/agents`                      |
| `/agents`                           | agent cards + selector                      |
| `/agents/$agentId`                  | scope layout with 4 tabs (below)            |
| `/agents/$agentId/`                 | overview shortcuts                          |
| `/agents/$agentId/kb`               | upload PDF/DOCX/TXT → S3 presign + Bedrock  |
| `/agents/$agentId/web`              | seed URL (single page or sitemap)           |
| `/agents/$agentId/skills`           | upload zip / SKILL.md; list; delete         |

Every admin fetch passes `x-tenant-id`, `x-agent-id`, `x-agent-version` — the
same header contract the middleware validates today (see `frontend/src/lib/scopeHeaders.ts`).

## Konami debug drawer

Press **↑ ↑ ↓ ↓ ← → ← → Q W** to toggle a slide-out panel with an inline
CodeMirror YAML editor loaded from `GET /agents/catalog`. Save writes back
through `PUT /agents/catalog`.

## Theme

Single **Savanna** theme (warm olive/amber, Geist Mono, sharp corners), default
`dark`. `THEME_INIT_SCRIPT` runs synchronously in `<head>` before hydration —
no light-mode flash. To flip to light for a session, `localStorage.agentcore_mode = 'light'`
and reload.

## What's intentionally missing right now

Locked scope for this migration slice — parity with today's frontend admin
surface, nothing more:

- No agent creation / no tenant creation.
- No versioning UI (branch endpoints exist on middleware; not wired here yet).
- No tool-mapping UI, no user management.
- No auth (middleware also has none today — same posture).
