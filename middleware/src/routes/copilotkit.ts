import { randomUUID } from 'node:crypto';
import { HttpAgent } from '@ag-ui/client';
import { CopilotRuntime, InMemoryAgentRunner } from '@copilotkit/runtime/v2';
import { createCopilotExpressHandler } from '@copilotkit/runtime/v2/express';

import { COPILOTKIT_UPSTREAM_URL } from '../config.js';

const runtime = new CopilotRuntime({
  runner: new InMemoryAgentRunner(),
  agents: ({ request }) => {
    const sessionId = request.headers.get('x-session-id') ?? randomUUID();

    return {
      default: new HttpAgent({
        url: COPILOTKIT_UPSTREAM_URL,
        headers: { 'x-session-id': sessionId },
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
