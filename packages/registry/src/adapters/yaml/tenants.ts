import type { TenantIdentity } from '../../domain/index.js';

import type { TenantRepository } from '../../interface.js';
import type { RegistryIndexes } from './parse.js';

export class S3YamlTenantRepo implements TenantRepository {
  constructor(private readonly getIndex: () => RegistryIndexes) {}

  async list(): Promise<TenantIdentity[]> {
    return [...this.getIndex().tenantsById.values()];
  }
}
