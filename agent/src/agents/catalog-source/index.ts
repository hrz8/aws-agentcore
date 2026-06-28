import { CATALOG_SOURCE, CATALOG_YAML_PATH } from '../../config.js';
import type { AgentCatalog } from '../catalog.js';
import { DatabaseAgentCatalog } from './database.js';
import { YamlAgentCatalog } from './yaml.js';

export type CatalogSource = 'yaml' | 'db';

export async function createCatalog(): Promise<AgentCatalog> {
  switch (CATALOG_SOURCE) {
    case 'yaml': {
      const cat = new YamlAgentCatalog(CATALOG_YAML_PATH);
      await cat.load();
      return cat;
    }
    case 'db': {
      const cat = new DatabaseAgentCatalog();
      await cat.load();
      return cat;
    }
  }
}
