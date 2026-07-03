import type { TenantIdentity } from '../../domain/index.js';

import type { TenantRepository } from '../../interface.js';

export type PgPool = unknown;

function notImplemented(): Error {
  return new Error('PostgresTenantRepo: not yet implemented — schema + queries TBD');
}

export class PostgresTenantRepo implements TenantRepository {
  constructor(_pool: PgPool) {}

  async list(): Promise<TenantIdentity[]> {
    throw notImplemented();
  }
}
