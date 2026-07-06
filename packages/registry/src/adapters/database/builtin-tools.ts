import type { BuiltinToolConfig } from '../../domain/index.js';
import type { BuiltinToolRepository } from '../../interface.js';

import type { PgPool } from './tenants.js';

export class PostgresBuiltinToolRepo implements BuiltinToolRepository {
  constructor(_pool: PgPool) {}

  async list(): Promise<Record<string, BuiltinToolConfig>> {
    throw new Error('PostgresBuiltinToolRepo: not yet implemented — schema + queries TBD');
  }
}
