import type { McpServerConfig } from '../../domain/index.js';

import type { McpServerRepository } from '../../interface.js';
import type { RegistryIndexes } from './parse.js';

export class S3YamlMcpServerRepo implements McpServerRepository {
  constructor(private readonly getIndex: () => RegistryIndexes) {}

  async listByTenantId(tenantId: string): Promise<Record<string, McpServerConfig>> {
    return this.getIndex().mcpByTenantId.get(tenantId) ?? {};
  }
}
