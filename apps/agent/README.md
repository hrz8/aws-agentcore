# agentcore-runtime

Sentec agent runtime — Strands agents packaged for AWS Bedrock AgentCore Runtime.
Starts as a minimal "hello agent" with no tools. Weather agent and tools are
planned next; see [Roadmap](#roadmap).

## Stack

- Node.js 24, pnpm 10 (via corepack), TypeScript (strict, NodeNext ESM)
- [`@strands-agents/sdk`](https://www.npmjs.com/package/@strands-agents/sdk) — agent framework
- [`bedrock-agentcore`](https://www.npmjs.com/package/bedrock-agentcore) — AgentCore Runtime app harness
- `zod` — request schema validation

## Prerequisites

- Node 24 (`nvm use` will pick it up from `.nvmrc`)
- AWS credentials with Bedrock access in your region (`aws configure` or env vars)
- Docker (only for container build/run)

## Setup

```bash
nvm use                 # node 24
corepack enable         # activates pnpm pinned in package.json
pnpm install
cp .env.example .env    # fill in AWS_REGION etc.
```

`pnpm-workspace.yaml` sets `minimumReleaseAge: 4320` (3 days, in minutes) — pnpm refuses
to install any package version published less than 3 days ago. Requires pnpm >= 10.16.
(Lives in `pnpm-workspace.yaml` not `.npmrc` so `npm` doesn't warn about unknown keys.)

## Local dev

Two equivalent ways to run locally:

### Option 1 — node directly (fast iteration)

```bash
pnpm dev                # tsx watch src/main.ts — auto-restart on file change
```

### Option 2 — `agentcore dev` (mirrors prod packaging)

```bash
pnpm exec agentcore dev --skip-deploy -p 5678
# or via the script alias
pnpm dev:agentcore -- --skip-deploy -p 5678
```

The CLI reads `agentcore/agentcore.json`, builds the runtime container from
`Dockerfile`, and runs it on the chosen port — same image shape you ship to
AWS. `--skip-deploy` keeps it local-only (no AWS resource creation).

### Invoke the agent

Either way, AgentCore exposes `POST /invocations`:

```bash
curl -N -X POST http://localhost:5678/invocations \
  -H 'Content-Type: application/json' \
  -H 'Accept: text/event-stream' \
  -H 'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id: local-session' \
  -d '{"prompt":"Say hello and tell me a one-line fun fact."}'
```

`Accept: text/event-stream` is required — the SDK refuses to stream without it
and responds `{"error":"Streaming response requires Accept: text/event-stream ..."}`.
The response is an SSE stream of `event: message\ndata: {"text":"..."}` chunks.

## Build & run (compiled)

```bash
pnpm build              # tsc → ./dist
pnpm start              # node dist/index.js
```

## Container

AgentCore Runtime requires `linux/arm64` images. The Dockerfile pins that platform.

```bash
pnpm docker:build       # build agentcore-runtime:dev
pnpm docker:run         # run on :8080 with env from .env
```

## Project layout

```
agentcore/
├── agentcore.json      # AgentCore CLI runtime config — used by `agentcore dev/deploy`
└── aws-targets.json    # deploy targets (account + region)
src/
├── main.ts             # AgentCore app entry — wires Strands agent into runtime
├── config.ts           # env loading
└── agents/
    └── simple.ts       # minimal Bedrock-backed agent, no tools
Dockerfile              # linux/arm64 multi-stage — referenced by agentcore.json
```

## Roadmap

Planned incremental additions (will land in follow-up commits):

1. **Tools** — port `get_location`, `get_weather_forecast`, `convert_temperature`,
   `get_current_datetime` from `agent-dev/agent/src/agents/demo/`.
2. **Weather agent** — `src/agents/weather.ts` with system prompt + the tools above.
3. **AGUI adapter** — alongside the current "simple SSE" handler, expose an
   AG-UI protocol entry for the web frontend.
4. **Telemetry** — OpenTelemetry traces (OTLP → ADOT/Langfuse).
5. **CDK** — separate stack for AgentCore Runtime deployment + ECR push.
