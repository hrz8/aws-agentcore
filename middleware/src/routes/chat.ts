import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { Router, type Request, type Response } from 'express';

import { createInvoker } from '../agents/index.js';

const router = Router();
const invoker = createInvoker();

router.post('/chat', async (req: Request, res: Response) => {
  const tenantId = req.header('x-tenant-id');
  if (!tenantId) {
    res.status(400).json({ error: 'x-tenant-id header required' });
    return;
  }
  const agentId = req.header('x-agent-id');
  if (!agentId) {
    res.status(400).json({ error: 'x-agent-id header required' });
    return;
  }
  const threadId = req.header('x-thread-id') ?? randomUUID();

  const sessionId = `${tenantId}-${agentId}-${threadId}`;

  // Bridge client disconnect to fetch so we don't keep the upstream stream
  // alive after the caller goes away. `res.on('close')` fires when the socket
  // closes; the writableFinished gate avoids tripping on normal completion.
  // `req.on('close')` is wrong here — it fires when the request BODY finishes
  // reading (right after express.json()), not when the client disconnects.
  const ac = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) ac.abort();
  });

  let upstream: globalThis.Response;
  try {
    upstream = await invoker.invoke({
      body: req.body,
      tenantId,
      agentId,
      sessionId,
      signal: ac.signal,
    });
  } catch (err) {
    res.status(502).json({
      error: 'agent invocation failed',
      detail: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  // Forward status + content-type so SSE / JSON pass through transparently.
  res.status(upstream.status);
  const contentType = upstream.headers.get('content-type');
  if (contentType) res.setHeader('content-type', contentType);
  res.setHeader('x-session-id', sessionId);

  if (!upstream.body) {
    res.end();
    return;
  }

  Readable.fromWeb(upstream.body as import('node:stream/web').ReadableStream).pipe(res);
});

export default router;
