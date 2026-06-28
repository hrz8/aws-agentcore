import { randomUUID } from 'node:crypto';
import { HttpAgent } from '@ag-ui/client';
import { CopilotRuntime, InMemoryAgentRunner } from '@copilotkit/runtime/v2';
import { createCopilotExpressHandler } from '@copilotkit/runtime/v2/express';

import { COPILOTKIT_UPSTREAM_URL } from '../config.js';

const runtime = new CopilotRuntime({
  runner: new InMemoryAgentRunner(),
  agents: ({ request }) => {
    const tenantId = request.headers.get('x-tenant-id') ?? '';
    const agentId = request.headers.get('x-agent-id') ?? '';
    const threadId = request.headers.get('x-thread-id') ?? randomUUID();

    return {
      default: new HttpAgent({
        url: COPILOTKIT_UPSTREAM_URL,
        headers: {
          'x-tenant-id': tenantId,
          'x-agent-id': agentId,
          'x-thread-id': threadId,
        },
      }),
    };
  },
});

const copilotkitRouter = createCopilotExpressHandler({
  runtime,
  basePath: '/copilotkit',
  cors: false, // CORS is already applied globally use `cors` library
});

export default copilotkitRouter;
