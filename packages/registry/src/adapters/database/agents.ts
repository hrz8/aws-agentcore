import type {
  AgentDefinition,
  AgentIdentity,
} from '../../domain/index.js';

import type { AgentRepository } from '../../interface.js';
import type { BranchInput, BranchResult } from '../../types.js';
import type { PgPool } from './tenants.js';

function notImplemented(): Error {
  return new Error('PostgresAgentRepo: not yet implemented — schema + queries TBD');
}

export class PostgresAgentRepo implements AgentRepository {
  constructor(_pool: PgPool) {}

  async listByTenantId(_tenantId: string): Promise<AgentDefinition[]> {
    throw notImplemented();
  }
  async listByTenantSlug(_tenantSlug: string): Promise<AgentDefinition[]> {
    throw notImplemented();
  }
  async getByIds(_tenantId: string, _agentId: string, _version: string): Promise<AgentDefinition | null> {
    throw notImplemented();
  }
  async getBySlugs(_tenantSlug: string, _agentSlug: string, _version: string): Promise<AgentDefinition | null> {
    throw notImplemented();
  }
  async resolveEnabledByIds(_tenantId: string, _agentId: string): Promise<AgentDefinition> {
    throw notImplemented();
  }
  async identities(_tenantId: string): Promise<AgentIdentity[]> {
    throw notImplemented();
  }
  async branch(_input: BranchInput): Promise<BranchResult> {
    throw notImplemented();
  }
}
