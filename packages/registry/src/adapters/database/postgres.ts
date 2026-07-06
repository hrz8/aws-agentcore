import type { RegistryRepository } from '../../interface.js';

import { PostgresAgentRepo } from './agents.js';
import { PostgresBuiltinToolRepo } from './builtin-tools.js';
import { PostgresMcpServerRepo } from './mcp.js';
import { PostgresTenantRepo, type PgPool } from './tenants.js';
import { PostgresVarRepo } from './vars.js';

export type PostgresRegistryRepositoryOptions = {
  connectionString: string;
  poolMax?: number;
};

export class PostgresRegistryRepository implements RegistryRepository {
  readonly tenants: PostgresTenantRepo;
  readonly agents: PostgresAgentRepo;
  readonly mcpServers: PostgresMcpServerRepo;
  readonly vars: PostgresVarRepo;
  readonly builtinTools: PostgresBuiltinToolRepo;
  readonly rawText = null;

  private readonly pool: PgPool;

  constructor(_opts: PostgresRegistryRepositoryOptions) {
    this.pool = {} as PgPool;
    this.tenants = new PostgresTenantRepo(this.pool);
    this.agents = new PostgresAgentRepo(this.pool);
    this.mcpServers = new PostgresMcpServerRepo(this.pool);
    this.vars = new PostgresVarRepo(this.pool);
    this.builtinTools = new PostgresBuiltinToolRepo(this.pool);
  }

  async refresh(): Promise<void> {}
}
