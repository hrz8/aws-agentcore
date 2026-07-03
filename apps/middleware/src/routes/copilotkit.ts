import { HttpAgent } from '@ag-ui/client';
import { CopilotRuntime, InMemoryAgentRunner } from '@copilotkit/runtime/v2';
import { createCopilotExpressHandler } from '@copilotkit/runtime/v2/express';

import { COPILOTKIT_UPSTREAM_URL } from '../config.js';

const FORWARDED_HEADERS = [
  'x-tenant-id',
  'x-agent-id',
  'x-agent-version',
  'x-actor-id',
];

const runtime = new CopilotRuntime({
  runner: new InMemoryAgentRunner(),
  agents: ({ request }) => {
    const headers: Record<string, string> = {};
    for (const h of FORWARDED_HEADERS) {
      const v = request.headers.get(h);
      if (v) headers[h] = v;
    }
    return {
      default: new HttpAgent({ url: COPILOTKIT_UPSTREAM_URL, headers }),
    };
  },
});

const copilotkitRouter = createCopilotExpressHandler({
  runtime,
  basePath: '/copilotkit',
  cors: false,
});

export default copilotkitRouter;
