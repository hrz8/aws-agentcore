import type { Message } from '@ag-ui/client';
import type { AgentRunner } from '@copilotkit/runtime/v2';
import { HttpAgent } from '@ag-ui/client';
import { CopilotRuntime } from '@copilotkit/runtime/v2';
import { createCopilotHonoHandler } from '@copilotkit/runtime/v2/hono';
import { Hono } from 'hono';

import { COPILOTKIT_UPSTREAM_URL, RUN_IN_LAMBDA } from '../config.js';
import { handleChatRequest, type ChatHeaders } from './chat.js';

type RunnerWithMessageHistory = AgentRunner & {
  getThreadMessagesAsync(threadId: string): Promise<Message[]>;
};

function hasMessageHistory(runner: AgentRunner): runner is RunnerWithMessageHistory {
  return typeof (runner as { getThreadMessagesAsync?: unknown }).getThreadMessagesAsync === 'function';
}

const FORWARDED_HEADERS = [
  'x-tenant-id',
  'x-agent-id',
  'x-agent-version',
  'x-actor-id',
] as const;

async function inProcessChatFetch(
  headers: Record<string, string>,
  requestInit: RequestInit,
): Promise<Response> {
  const body = typeof requestInit.body === 'string'
    ? JSON.parse(requestInit.body)
    : requestInit.body ?? {};
  return handleChatRequest({
    headers: headers as ChatHeaders,
    body,
    signal: requestInit.signal ?? undefined,
  });
}

export function createCopilotkitApp(runner: AgentRunner) {
  const runtime = new CopilotRuntime({
    runner,
    agents: ({ request }) => {
      const headers: Record<string, string> = {};
      for (const h of FORWARDED_HEADERS) {
        const v = request.headers.get(h);
        if (v) headers[h] = v;
      }
      const agent = RUN_IN_LAMBDA
        ? new HttpAgent({
            url: 'in-process://chat',
            headers,
            fetch: (_url, init) => inProcessChatFetch(headers, init),
          })
        : new HttpAgent({ url: COPILOTKIT_UPSTREAM_URL, headers });
      return { default: agent };
    },
  });

  // cors suppressed — outer Hono cors() (local) or Function URL native CORS
  // (Lambda) is the single source; layering both duplicates headers.
  const copilotkitHandler = createCopilotHonoHandler({
    runtime,
    basePath: '/copilotkit',
    ...(RUN_IN_LAMBDA ? { mode: 'single-route' as const } : {}),
    cors: { origin: () => null },
  });

  const app = new Hono();

  if (RUN_IN_LAMBDA) {
    app.get('/copilotkit/threads/:threadId/messages', async (c) => {
      if (!hasMessageHistory(runner)) {
        return c.json({ messages: [] });
      }
      try {
        const messages = await runner.getThreadMessagesAsync(c.req.param('threadId'));
        return c.json({ messages });
      } catch (err) {
        console.error('[copilotkit] getThreadMessagesAsync failed', err);
        return c.json({ messages: [] });
      }
    });

    app.get('/copilotkit/info', async (c) => {
      const url = new URL(c.req.url);
      const proxied = new Request(`${url.origin}/copilotkit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ method: 'info' }),
      });
      return copilotkitHandler.fetch(proxied);
    });
  }

  app.route('/', copilotkitHandler);
  return app;
}
