import { isUuid } from '@repo/kit/identity';
import { resolveAgentWithLive } from '@repo/registry';
import { Router } from 'express';
import { z } from 'zod';

import { getRegistry } from '../registry.js';

const router = Router();

const scopeQuerySchema = z.object({
  tenant: z.string().refine(isUuid, 'tenant must be a UUID'),
  agent: z.string().refine(isUuid, 'agent must be a UUID'),
  version: z.string().min(1, 'version is required'),
});

router.get('/scope', async (req, res) => {
  const parsed = scopeQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message ?? 'invalid scope query params',
    });
    return;
  }
  const { tenant: tenantId, agent: agentId, version } = parsed.data;

  try {
    const registry = await getRegistry();
    const tenants = await registry.tenants.list();
    const tenant = tenants.find((t) => t.tenantId === tenantId);
    if (!tenant) {
      res.status(404).json({ error: 'tenant not found' });
      return;
    }
    const agent = await resolveAgentWithLive(registry, tenantId, agentId, version);
    if (!agent) {
      res.status(404).json({ error: 'agent not found' });
      return;
    }
    res.json({
      tenantId,
      tenantSlug: tenant.tenantSlug,
      tenantName: tenant.tenantName,
      agentId,
      agentSlug: agent.agentSlug,
      agentVersion: agent.version,
    });
  } catch (err) {
    console.error('[middleware] /scope failed', err);
    res.status(500).json({ error: 'scope lookup failed' });
  }
});

export default router;
