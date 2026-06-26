import { promisify } from 'node:util';
import express from 'express';

import { AGENT_MODE, PORT } from './config.js';
import chatRouter from './routes/chat.js';
import healthRouter from './routes/health.js';
import { shutdown } from './shutdown.js';

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(healthRouter);
app.use(chatRouter);

const server = app.listen(PORT, () => {
  console.info(`[middleware] listening on http://localhost:${PORT} (agent mode: ${AGENT_MODE})`);
});

shutdown('middleware', () => promisify(server.close).call(server));
