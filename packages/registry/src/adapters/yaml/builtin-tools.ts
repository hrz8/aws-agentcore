import type { BuiltinToolConfig } from '../../domain/index.js';
import type { BuiltinToolRepository } from '../../interface.js';

import type { RegistryIndexes } from './parse.js';

export class S3YamlBuiltinToolRepo implements BuiltinToolRepository {
  constructor(private readonly getIndex: () => RegistryIndexes) {}

  async list(): Promise<Record<string, BuiltinToolConfig>> {
    return this.getIndex().builtinTools;
  }
}
