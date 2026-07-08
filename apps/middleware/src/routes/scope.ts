import { isUuid } from '@repo/kit/identity';
import { resolveAgentWithLive } from '@repo/registry';
import { Hono } from 'hono';
import { z } from 'zod';

import { getRegistry } from '../registry.js';

const app = new Hono();

const scopeQuerySchema = z.object({
  tenant: z.string().refine(isUuid, 'tenant must be a UUID'),
  agent: z.string().refine(isUuid, 'agent must be a UUID'),
  version: z.string().min(1, 'version is required'),
});

app.get('/scope', async (c) => {
  const parsed = scopeQuerySchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!parsed.success) {
    return c.json(
      { error: parsed.error.issues[0]?.message ?? 'invalid scope query params' },
      400,
    );
  }
  const { tenant: tenantId, agent: agentId, version } = parsed.data;

  try {
    const registry = await getRegistry();
    const tenants = await registry.tenants.list();
    const tenant = tenants.find((t) => t.tenantId === tenantId);
    if (!tenant) {
      return c.json({ error: 'tenant not found' }, 404);
    }
    const agent = await resolveAgentWithLive(registry, tenantId, agentId, version);
    if (!agent) {
      return c.json({ error: 'agent not found' }, 404);
    }
    return c.json({
      tenantId,
      tenantSlug: tenant.tenantSlug,
      tenantName: tenant.tenantName,
      agentId,
      agentSlug: agent.agentSlug,
      agentVersion: agent.version,
    });
  } catch (err) {
    console.error('[middleware] /scope failed', err);
    return c.json({ error: 'scope lookup failed' }, 500);
  }
});

export default app;
