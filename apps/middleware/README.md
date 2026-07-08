# middleware

HTTP middleware that sits in front of the agent. Exposes a stable `/chat`
endpoint and proxies streaming SSE responses through to clients. Today it
talks to the local `agent/` server; tomorrow it will also call a deployed
AgentCore Runtime ARN over SigV4.

## Setup

```bash
nvm use                 # node 24
corepack enable
pnpm install
cp .env.example .env
```

## Run

```bash
pnpm dev                # tsx watch — auto-restart on file change
```

Then invoke (agent must also be running on `:5678`):

```bash
curl -N -X POST http://localhost:7890/chat \
  -H 'Content-Type: application/json' \
  -H 'Accept: text/event-stream' \
  -d '{"prompt":"hello, one fun fact please"}'
```

Health: `GET /healthz` → `{"status":"ok"}`.

## Composition

`src/agents/invoker.ts` defines a single `AgentInvoker` interface. Two
implementations:

- `PlainHttpInvoker` — plain `fetch` to `AGENT_PLAIN_URL/invocations`, no
  signing. Works for any HTTP-reachable agent that doesn't require IAM auth
  (localhost in dev, internal cluster DNS, VPC-internal LB).
- `AgentCoreInvoker` — SigV4-signed fetch against a deployed AgentCore Runtime
  ARN (planned; see `../agent-dev/backend/src/shared/agent.ts` in the agent-dev
  repo for the reference)

Pick at boot via `AGENT_MODE=plain|agentcore` in `.env`. The `/chat` route
holds no transport-specific knowledge — it just forwards the body, passes the
session id, pipes the response stream.

## Layout

```
src/
├── main.ts             # express app + listen
├── config.ts           # env parsing
├── agents/
│   ├── invoker.ts      # AgentInvoker interface
│   ├── plain.ts        # PlainHttpInvoker — unsigned HTTP
│   └── index.ts        # createInvoker() factory keyed by AGENT_MODE
└── routes/
    ├── chat.ts         # POST /chat — proxies to the invoker
    └── health.ts       # GET /healthz
```
