import { randomUUID } from 'node:crypto';
import { composeActorId, composeRuntimeSessionId } from '@repo/kit/identity';
import { isLiveAlias, resolveAgentWithLive } from '@repo/registry';
import { Hono } from 'hono';

import { createInvoker } from '../agents/index.js';
import { getRegistry } from '../registry.js';
import { readScopeFromHeaders } from '../utils/scope.js';

const app = new Hono();
const invoker = createInvoker();

function extractThreadId(body: unknown): string {
  if (
    body !== null
    && typeof body === 'object'
    && 'threadId' in body
    && typeof (body as { threadId: unknown }).threadId === 'string'
    && (body as { threadId: string }).threadId.length > 0
  ) {
    return (body as { threadId: string }).threadId;
  }
  return randomUUID();
}

export type ChatHeaders = {
  'x-tenant-id'?: string;
  'x-agent-id'?: string;
  'x-agent-version'?: string;
  'x-actor-id'?: string;
};

export async function handleChatRequest(input: {
  headers: ChatHeaders;
  body: unknown;
  signal?: AbortSignal;
}): Promise<Response> {
  const scoped = readScopeFromHeaders({
    tenantId: input.headers['x-tenant-id'],
    agentId: input.headers['x-agent-id'],
    agentVersion: input.headers['x-agent-version'],
  });
  if (!scoped.ok) {
    return Response.json({ error: scoped.error }, { status: scoped.status });
  }
  const { tenantId, agentId, agentVersion } = scoped.scope;

  let resolvedVersion: string;
  if (agentVersion === null || isLiveAlias(agentVersion)) {
    try {
      const registry = await getRegistry();
      await registry.refresh();
      const def = await resolveAgentWithLive(registry, tenantId, agentId, 'live');
      if (!def) {
        return Response.json(
          { error: `no enabled version for agent ${agentId} in tenant ${tenantId}` },
          { status: 404 },
        );
      }
      resolvedVersion = def.version;
    } catch (err) {
      return Response.json(
        {
          error: 'live version resolution failed',
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 500 },
      );
    }
  } else {
    resolvedVersion = agentVersion;
  }

  const rawActor = input.headers['x-actor-id'];
  const actorId = composeActorId(tenantId, rawActor);
  const body = input.body ?? {};
  const threadId = extractThreadId(body);
  const runtimeSessionId = composeRuntimeSessionId({
    tenantId, agentId, agentVersion: resolvedVersion, rawActor, threadId,
  });

  if (typeof body === 'object' && body !== null) {
    (body as { forwardedProps?: Record<string, unknown> }).forwardedProps = {
      ...(body as { forwardedProps?: Record<string, unknown> }).forwardedProps,
      tenantId,
      agentId,
      agentVersion: resolvedVersion,
      actorId,
    };
  }

  let upstream: Response;
  try {
    upstream = await invoker.invoke({
      body,
      sessionId: runtimeSessionId,
      signal: input.signal,
    });
  } catch (err) {
    return Response.json(
      {
        error: 'agent invocation failed',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'text/event-stream',
    },
  });
}

app.post('/chat', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return handleChatRequest({
    headers: {
      'x-tenant-id': c.req.header('x-tenant-id'),
      'x-agent-id': c.req.header('x-agent-id'),
      'x-agent-version': c.req.header('x-agent-version'),
      'x-actor-id': c.req.header('x-actor-id'),
    },
    body,
    signal: c.req.raw.signal,
  });
});

export default app;
