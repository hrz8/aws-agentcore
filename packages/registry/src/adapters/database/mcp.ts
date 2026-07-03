import type { McpServerConfig } from '../../domain/index.js';

import type { McpServerRepository } from '../../interface.js';
import type { PgPool } from './tenants.js';

function notImplemented(): Error {
  return new Error('PostgresMcpServerRepo: not yet implemented — schema + queries TBD');
}

export class PostgresMcpServerRepo implements McpServerRepository {
  constructor(_pool: PgPool) {}

  async listByTenantId(_tenantId: string): Promise<Record<string, McpServerConfig>> {
    throw notImplemented();
  }
}
