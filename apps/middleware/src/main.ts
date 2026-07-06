import { promisify } from 'node:util';
import cors from 'cors';
import express from 'express';

import { AGENT_MODE, CORS_ORIGIN, PORT } from './config.js';
import chatRouter from './routes/chat.js';
import copilotkitRouter from './routes/copilotkit.js';
import healthRouter from './routes/health.js';
import scopeRouter from './routes/scope.js';
import { shutdown } from './shutdown.js';

const app = express();

app.use(
  cors({
    origin: CORS_ORIGIN.includes('*') ? true : CORS_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json({ limit: '50mb' }));
app.use(healthRouter);
app.use(scopeRouter);
app.use(chatRouter);
app.use(copilotkitRouter);

const server = app.listen(PORT, () => {
  console.info(`[middleware] listening on http://localhost:${PORT} (agent mode: ${AGENT_MODE})`);
});

shutdown('middleware', () => promisify(server.close).call(server));
