import { promisify } from 'node:util';
import { StrandsAgent } from '@ag-ui/aws-strands';
import { addPing, addStrandsExpressEndpoint } from '@ag-ui/aws-strands/server';
import cors from 'cors';
import express from 'express';

import { createSimpleAgent } from './agents/simple.js';
import { MEMORY_PROVIDER, PORT } from './config.js';
import { createMemoryManager } from './memory/factory.js';
import { MemorySessionManager } from './memory/session-manager.js';
import { createMemorySnapshotStorage } from './memory/snapshot-storage.js';
import { shutdown } from './shutdown.js';

const MEMORY_SNAPSHOT_STORAGE = createMemorySnapshotStorage();

const aguiAgent = new StrandsAgent({
  agent: createSimpleAgent(),
  name: 'simple_agent',
  description: 'Demo agent with temperature conversion tool',
  config: {
    sessionManagerProvider: async (input) => {
      const actorId = input.forwardedProps?.actorId;
      if (typeof actorId !== 'string' || actorId.length === 0) {
        console.warn('[agent] actorId missing; skipping memory wiring for thread', input.threadId);
        return undefined;
      }
      const memoryManager = createMemoryManager({ actorId, sessionId: input.threadId });
      if (!memoryManager) return undefined;
      return new MemorySessionManager({
        sessionId: input.threadId,
        memoryManager,
        snapshot: MEMORY_SNAPSHOT_STORAGE,
      });
    },
  },
});

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
addPing(app, '/ping');
addStrandsExpressEndpoint(app, aguiAgent, { path: '/invocations' });

const server = app.listen(PORT, () => {
  console.info(`[agent] listening on http://localhost:${PORT}`);
  console.info(`[agent] memory provider: ${MEMORY_PROVIDER}`);
});

shutdown('agent', () => promisify(server.close).call(server));
