import {
  PostgresRegistryRepository,
  S3YamlRegistryRepository,
  type RegistryRepository,
} from '@repo/registry';

import {
  AWS_REGION,
  REGISTRY_DB_URL,
  REGISTRY_S3_KEY,
  REGISTRY_SOURCE,
  RegistrySource,
  UPLOADS_BUCKET,
} from './config.js';

let registryPromise: Promise<RegistryRepository> | null = null;

export function getRegistry(): Promise<RegistryRepository> {
  if (!registryPromise) {
    registryPromise = build();
  }
  return registryPromise;
}

async function build(): Promise<RegistryRepository> {
  switch (REGISTRY_SOURCE) {
    case RegistrySource.S3Yaml: {
      if (!UPLOADS_BUCKET) {
        throw new Error(`REGISTRY_SOURCE=${RegistrySource.S3Yaml} requires UPLOADS_BUCKET`);
      }
      const repo = new S3YamlRegistryRepository({
        bucket: UPLOADS_BUCKET,
        key: REGISTRY_S3_KEY,
        region: AWS_REGION,
        parseOpts: { allowedBuiltinTools: null },
      });
      await repo.refresh();
      return repo;
    }
    case RegistrySource.DbPostgres: {
      if (!REGISTRY_DB_URL) {
        throw new Error(`REGISTRY_SOURCE=${RegistrySource.DbPostgres} requires REGISTRY_DB_URL`);
      }
      return new PostgresRegistryRepository({ connectionString: REGISTRY_DB_URL });
    }
  }
}
