import { promisify } from 'node:util';
import { StrandsAgent } from '@ag-ui/aws-strands';
import { createStrandsApp } from '@ag-ui/aws-strands/server';

import { createSimpleAgent } from './agents/simple.js';
import { PORT } from './config.js';
import { shutdown } from './shutdown.js';

const aguiAgent = new StrandsAgent({
  agent: createSimpleAgent(),
  name: 'simple_agent',
  description: 'Demo agent with temperature conversion tool',
});

const app = await createStrandsApp(aguiAgent, {
  path: '/invocations',
  pingPath: '/ping',
});

const server = app.listen(PORT, () => {
  console.info(`[agent] listening on http://localhost:${PORT}`);
});

shutdown('agent', () => promisify(server.close).call(server));
