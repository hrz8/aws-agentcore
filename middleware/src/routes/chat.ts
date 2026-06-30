import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { Router, type Request, type Response } from 'express';

import { createInvoker } from '../agents/index.js';

const router = Router();
const invoker = createInvoker();

// Sole place these prefixes are built; route every caller through the compose helpers so tenant scoping can't drift across call sites.
const TENANT_SLUG = 'trinitywizards';
const AGENT_SLUG = 'simple';
const RUNTIME_SESSION_ID_MAX = 128;
const RAW_ACTOR_MAX = 64;

function sanitizeIdPart(value: string, maxLength: number): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, maxLength);
}

function sanitizeActor(rawActor: string | undefined): string {
  return rawActor ? sanitizeIdPart(rawActor, RAW_ACTOR_MAX) : 'guest';
}

// Memory actorId: `{tenant}__{actor}`. Tenant-wide so agents under the same tenant share LTM.
function composeActorId(rawActor: string | undefined): string {
  return `${TENANT_SLUG}__${sanitizeActor(rawActor)}`;
}

// Runtime sessionId: `{tenant}__{agent}__{actor}__{thread}`. Trailing UUID guarantees ≥33 chars and per-conversation container affinity.
function composeRuntimeSessionId(rawActor: string | undefined, threadId: string): string {
  const composed = `${TENANT_SLUG}__${AGENT_SLUG}__${sanitizeActor(rawActor)}__${threadId}`;
  return composed.length > RUNTIME_SESSION_ID_MAX
    ? composed.slice(-RUNTIME_SESSION_ID_MAX)
    : composed;
}

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
  const rawActor = req.header('x-actor-id');
  const actorId = composeActorId(rawActor);
  const threadId = extractThreadId(req.body);
  const runtimeSessionId = composeRuntimeSessionId(rawActor, threadId);

  if (typeof req.body === 'object' && req.body !== null) {
    const body = req.body as { forwardedProps?: Record<string, unknown> };
    body.forwardedProps = { ...body.forwardedProps, actorId };
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
