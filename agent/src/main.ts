import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { StrandsAgent } from '@ag-ui/aws-strands';
import { addPing, addStrandsExpressEndpoint } from '@ag-ui/aws-strands/server';
import cors from 'cors';
import express from 'express';

import { createSimpleAgent } from './agents/simple.js';
import { MEMORY_PROVIDER, PORT } from './config.js';
import { createMemoryManager } from './memory/factory.js';
import { AgentSessionManager } from './session/session-manager.js';
import { createMemorySnapshotStorage } from './memory/snapshot-storage.js';
import { shutdown } from './shutdown.js';

const BOOT_ID = randomUUID();
const BOOT_AT_ISO = new Date().toISOString();
console.info(`[agent] boot id=${BOOT_ID} at=${BOOT_AT_ISO} pid=${process.pid}`);

const MEMORY_SNAPSHOT_STORAGE = createMemorySnapshotStorage();
const { agent: strandsAgent, refreshSkillsIfStale, skillsPlugin } = await createSimpleAgent();

const aguiAgent = new StrandsAgent({
  agent: strandsAgent,
  name: 'simple_agent',
  description: 'Demo agent with temperature conversion tool',
  config: {
    sessionManagerProvider: async (input) => {
      console.info(
        `[agent] session-start thread=${input.threadId} boot=${BOOT_ID} bootAt=${BOOT_AT_ISO}`,
      );
      const actorId = input.forwardedProps?.actorId;
      if (typeof actorId !== 'string' || actorId.length === 0) {
        console.warn('[agent] actorId missing; skipping memory wiring for thread', input.threadId);
        return undefined;
      }
      const memoryManager = createMemoryManager({ actorId, sessionId: input.threadId });
      if (!memoryManager) return undefined;
      return new AgentSessionManager({
        sessionId: input.threadId,
        memoryManager,
        snapshot: MEMORY_SNAPSHOT_STORAGE,
        beforeInvocation: refreshSkillsIfStale,
        skillsPlugin,
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
