import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { streamHandle } from 'hono/aws-lambda';
import { cors } from 'hono/cors';

import { AGENT_MODE, CORS_ORIGIN, PORT, RUN_IN_LAMBDA } from './config.js';
import chatApp from './routes/chat.js';
import { createCopilotkitApp } from './routes/copilotkit.js';
import healthApp from './routes/health.js';
import scopeApp from './routes/scope.js';
import { createRunner } from './runners/factory.js';
import { shutdown } from './shutdown.js';

const runner = await createRunner();
const copilotkitApp = createCopilotkitApp(runner);

const app = new Hono();

// Lambda uses Function URL native CORS — gate this off to avoid duplicate headers.
if (!RUN_IN_LAMBDA) {
  app.use(
    '*',
    cors({
      origin: (origin) => {
        if (CORS_ORIGIN.includes('*')) return origin || '*';
        return CORS_ORIGIN.includes(origin) ? origin : null;
      },
      credentials: true,
    }),
  );
}

app.route('/', healthApp);
app.route('/', scopeApp);
app.route('/', chatApp);
app.route('/', copilotkitApp);

// streamHandle() reaches for the awslambda global at call time, not on invoke.
export const handler = RUN_IN_LAMBDA ? streamHandle(app) : undefined;

if (!RUN_IN_LAMBDA) {
  const server = serve(
    { fetch: app.fetch, port: PORT },
    (info) => {
      console.info(`[middleware] listening on http://localhost:${info.port} (agent mode: ${AGENT_MODE})`);
    },
  );

  shutdown('middleware', () => new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  }));
}
