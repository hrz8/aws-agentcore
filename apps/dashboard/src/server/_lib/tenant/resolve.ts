import { AppError, ErrorCode } from '#/shared/errors';
import type { ResolvedServerScope, WireScope } from '#/shared/scope';

import { getRegistryRepo } from '#/server/repositories';

// Cross-tenant guard: verifies (tenantId, agentId, version) exists together
// before any downstream mutation runs. Not middleware because TanStack Start
// middleware runs before the input validator can populate data.tenantSlug.
export async function resolveTenantScope(
  wire: WireScope,
): Promise<ResolvedServerScope> {
  const repo = await getRegistryRepo();
  const tenants = await repo.tenants.list();
  const match = tenants.find((t) => t.tenantSlug === wire.tenantSlug);
  if (!match) {
    throw new AppError(ErrorCode.TenantNotFound, {
      message: `unknown tenant: ${wire.tenantSlug}`,
      meta: { tenantSlug: wire.tenantSlug },
    });
  }

  const agent = await repo.agents.getByIds(
    match.tenantId,
    wire.agentId,
    wire.version,
  );
  if (!agent) {
    throw new AppError(ErrorCode.NotFound, {
      message: 'agent version not found in this tenant',
      meta: {
        tenantSlug: match.tenantSlug,
        agentId: wire.agentId,
        version: wire.version,
      },
    });
  }

  return {
    tenantId: match.tenantId,
    tenantSlug: match.tenantSlug,
    agentId: wire.agentId,
    version: wire.version,
  };
}
