import type { AgentDefinition } from './domain/index.js';
import type { RegistryRepository } from './interface.js';

export const LIVE_VERSION_ALIAS = 'live';

export function isLiveAlias(version: string | undefined | null): boolean {
  return version === LIVE_VERSION_ALIAS;
}

export async function resolveAgentWithLive(
  registry: RegistryRepository,
  tenantId: string,
  agentId: string,
  version: string,
): Promise<AgentDefinition | null> {
  if (isLiveAlias(version)) {
    try {
      return await registry.agents.resolveEnabledByIds(tenantId, agentId);
    } catch {
      return null;
    }
  }
  return registry.agents.getByIds(tenantId, agentId, version);
}
