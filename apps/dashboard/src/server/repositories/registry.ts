import {
  PostgresRegistryRepository,
  S3YamlRegistryRepository,
  type RegistryRepository,
} from '@repo/registry';
import { LocalYamlRegistryRepository } from '@repo/registry/local-yaml';

import {
  AWS_REGION,
  KB_STAGE,
  REGISTRY_DB_URL,
  REGISTRY_LOCAL_YAML_PATH,
  REGISTRY_S3_KEY,
  REGISTRY_SOURCE,
  RegistrySource,
} from '#/server/config';

// YAML strategy warms its cache in .refresh() — memoise the load promise so
// concurrent boot-time callers can't race an empty tenant list.
let registrySingleton: RegistryRepository | null = null;
let registryLoadPromise: Promise<RegistryRepository> | null = null;

export async function getRegistryRepo(): Promise<RegistryRepository> {
  if (registrySingleton) {
    return registrySingleton;
  }
  if (registryLoadPromise) {
    return registryLoadPromise;
  }
  registryLoadPromise = createRegistry().then((repo) => {
    registrySingleton = repo;
    registryLoadPromise = null;
    return repo;
  });
  return registryLoadPromise;
}

async function createRegistry(): Promise<RegistryRepository> {
  switch (REGISTRY_SOURCE) {
    case RegistrySource.S3Yaml: {
      if (!KB_STAGE) {
        throw new Error(
          `REGISTRY_SOURCE=${RegistrySource.S3Yaml} requires UPLOADS_BUCKET to be set`,
        );
      }
      const repo = new S3YamlRegistryRepository({
        bucket: KB_STAGE.uploadsBucket,
        key: REGISTRY_S3_KEY,
        region: AWS_REGION,
        disableAutoRefresh: true,
        parseOpts: { allowedBuiltinTools: null },
      });
      await repo.refresh();
      return repo;
    }
    case RegistrySource.LocalYaml: {
      if (!REGISTRY_LOCAL_YAML_PATH) {
        throw new Error(
          `REGISTRY_SOURCE=${RegistrySource.LocalYaml} requires REGISTRY_LOCAL_YAML_PATH to be set`,
        );
      }
      const repo = new LocalYamlRegistryRepository({
        path: REGISTRY_LOCAL_YAML_PATH,
        disableAutoRefresh: true,
        parseOpts: { allowedBuiltinTools: null },
      });
      await repo.refresh();
      return repo;
    }
    case RegistrySource.DbPostgres: {
      if (!REGISTRY_DB_URL) {
        throw new Error(
          `REGISTRY_SOURCE=${RegistrySource.DbPostgres} requires REGISTRY_DB_URL to be set`,
        );
      }
      return new PostgresRegistryRepository({ connectionString: REGISTRY_DB_URL });
    }
  }
}
