import { promisify } from 'node:util';
import { StrandsAgent } from '@ag-ui/aws-strands';
import { createStrandsApp } from '@ag-ui/aws-strands/server';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';

import { createCatalog } from './agents/catalog-source/index.js';
import { buildAgent } from './agents/factory.js';
import { CATALOG_SOURCE, PORT } from './config.js';
import { shutdown } from './shutdown.js';

const catalog = await createCatalog();
console.info(`[agent] catalog source: ${CATALOG_SOURCE}`);

const cache = new Map<string, Express>();

async function getOrBuild(tenantId: string, agentId: string): Promise<Express | null> {
  const key = `${tenantId}/${agentId}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const def = await catalog.get(tenantId, agentId);
  if (!def) return null;

  console.info(`[agent] building ${key} on first use`);
  const agent = await buildAgent(def, catalog);
  const agui = new StrandsAgent({
    agent,
    name: def.id,
    description: def.description,
  });
  const subApp = await createStrandsApp(agui, {
    path: '/invocations',
    pingPath: null, // outer app owns /ping
  });
  cache.set(key, subApp);
  return subApp;
}

const app = express();

app.get('/ping', (_req, res) => {
  res.json({ status: 'healthy' });
});

app.post('/invocations', async (req: Request, res: Response, next: NextFunction) => {
  const tenantId = req.header('x-tenant-id');
  const agentId = req.header('x-agent-id');
  if (!tenantId) {
    res.status(400).json({ error: 'x-tenant-id header required' });
    return;
  }
  if (!agentId) {
    res.status(400).json({ error: 'x-agent-id header required' });
    return;
  }

  let subApp: Express | null;
  try {
    subApp = await getOrBuild(tenantId, agentId);
  } catch (err) {
    res.status(500).json({
      error: 'failed to build agent',
      detail: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  if (!subApp) {
    const available = (await catalog.list(tenantId)).map(a => a.id);
    res.status(404).json({
      error: `unknown agent: ${tenantId}/${agentId}`,
      available,
    });
    return;
  }

  subApp(req, res, next);
});

const server = app.listen(PORT, () => {
  console.info(`[agent] listening on http://localhost:${PORT}`);
});

shutdown('agent', () => promisify(server.close).call(server));
