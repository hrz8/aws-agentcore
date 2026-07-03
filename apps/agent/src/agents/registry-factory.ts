import {
  PostgresRegistryRepository,
  S3YamlRegistryRepository,
  type ParseOptions,
  type RegistryRepository,
} from '@repo/registry';

import {
  AWS_REGION,
  REGISTRY_DB_URL,
  REGISTRY_S3_KEY,
  REGISTRY_SOURCE,
  RegistrySource,
  UPLOADS_BUCKET,
} from '../config.js';
import { BUILTIN_TOOLS } from '../tools/_lib/registry.js';

const parseOpts: ParseOptions = {
  allowedBuiltinTools: new Set(Object.keys(BUILTIN_TOOLS)),
};

export async function createRegistryRepository(): Promise<RegistryRepository> {
  switch (REGISTRY_SOURCE) {
    case RegistrySource.S3Yaml: {
      if (!UPLOADS_BUCKET) {
        throw new Error(`REGISTRY_SOURCE=${RegistrySource.S3Yaml} requires UPLOADS_BUCKET to be set`);
      }
      const repo = new S3YamlRegistryRepository({
        bucket: UPLOADS_BUCKET,
        key: REGISTRY_S3_KEY,
        region: AWS_REGION,
        parseOpts,
      });
      await repo.refresh();
      return repo;
    }
    case RegistrySource.DbPostgres: {
      if (!REGISTRY_DB_URL) {
        throw new Error(`REGISTRY_SOURCE=${RegistrySource.DbPostgres} requires REGISTRY_DB_URL to be set`);
      }
      return new PostgresRegistryRepository({ connectionString: REGISTRY_DB_URL });
    }
  }
}
