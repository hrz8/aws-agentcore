import type { Var } from '../../domain/index.js';

import type { VarRepository } from '../../interface.js';
import type { RegistryIndexes } from './parse.js';

export class S3YamlVarRepo implements VarRepository {
  constructor(private readonly getIndex: () => RegistryIndexes) {}

  async listByTenantId(tenantId: string): Promise<Record<string, Var>> {
    return this.getIndex().varsByTenantId.get(tenantId) ?? {};
  }
}
