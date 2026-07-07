import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { Router, type Request, type Response } from 'express';

import { composeActorId, composeRuntimeSessionId } from '@repo/kit/identity';
import { isLiveAlias, resolveAgentWithLive } from '@repo/registry';

import { createInvoker } from '../agents/index.js';
import { getRegistry } from '../registry.js';
import { readScopeFromHeaders } from '../utils/scope.js';

const router = Router();
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

router.post('/chat', async (req: Request, res: Response) => {
  const scoped = readScopeFromHeaders({
    tenantId: req.header('x-tenant-id'),
    agentId: req.header('x-agent-id'),
    agentVersion: req.header('x-agent-version'),
  });
  if (!scoped.ok) {
    res.status(scoped.status).json({ error: scoped.error });
    return;
  }
  const { tenantId, agentId, agentVersion } = scoped.scope;

  let resolvedVersion: string;
  if (agentVersion === null || isLiveAlias(agentVersion)) {
    try {
      const registry = await getRegistry();
      await registry.refresh();
      const def = await resolveAgentWithLive(registry, tenantId, agentId, 'live');
      if (!def) {
        res.status(404).json({
          error: `no enabled version for agent ${agentId} in tenant ${tenantId}`,
        });
        return;
      }
      resolvedVersion = def.version;
    } catch (err) {
      res.status(500).json({
        error: 'live version resolution failed',
        detail: err instanceof Error ? err.message : String(err),
      });
      return;
    }
  } else {
    resolvedVersion = agentVersion;
  }

  const rawActor = req.header('x-actor-id');
  const actorId = composeActorId(tenantId, rawActor);
  const threadId = extractThreadId(req.body);
  const runtimeSessionId = composeRuntimeSessionId({
    tenantId, agentId, agentVersion: resolvedVersion, rawActor, threadId,
  });

  if (typeof req.body === 'object' && req.body !== null) {
    const body = req.body as { forwardedProps?: Record<string, unknown> };
    body.forwardedProps = {
      ...body.forwardedProps,
      tenantId,
      agentId,
      agentVersion: resolvedVersion,
      actorId,
    };
  }

  const ac = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) ac.abort();
  });

  let upstream: globalThis.Response;
  try {
    upstream = await invoker.invoke({
      body: req.body,
      sessionId: runtimeSessionId,
      signal: ac.signal,
    });
  } catch (err) {
    res.status(502).json({
      error: 'agent invocation failed',
      detail: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  res.status(upstream.status);
  const contentType = upstream.headers.get('content-type');
  if (contentType) res.setHeader('content-type', contentType);

  if (!upstream.body) {
    res.end();
    return;
  }

  Readable.fromWeb(upstream.body as import('node:stream/web').ReadableStream).pipe(res);
});

export default router;
