import type { Var } from '../../domain/index.js';

import type { VarRepository } from '../../interface.js';
import type { PgPool } from './tenants.js';

function notImplemented(): Error {
  return new Error('PostgresVarRepo: not yet implemented — schema + queries TBD');
}

export class PostgresVarRepo implements VarRepository {
  constructor(_pool: PgPool) {}

  async listByTenantId(_tenantId: string): Promise<Record<string, Var>> {
    throw notImplemented();
  }
}
