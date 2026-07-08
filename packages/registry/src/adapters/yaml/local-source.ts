import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import type { ParseOptions } from './parse.js';
import { YamlRegistryRepository } from './registry.js';
import type { YamlSource, YamlSourceReadResult } from './source.js';

export type LocalYamlSourceOptions = {
  /** Relative paths are resolved against `process.cwd()`. */
  path: string;
};

/** Local-dev only. Non-atomic write; no concurrent-writer coordination. */
export class LocalYamlSource implements YamlSource {
  private readonly path: string;

  constructor(opts: LocalYamlSourceOptions) {
    this.path = resolve(opts.path);
  }

  async read(): Promise<YamlSourceReadResult> {
    try {
      const text = await readFile(this.path, 'utf-8');
      return { kind: 'ok', text, etag: undefined };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`registry missing: ${this.describe()} does not exist.`);
      }
      throw err;
    }
  }

  async write(text: string): Promise<{ etag: string | undefined }> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, text, 'utf-8');
    return { etag: undefined };
  }

  describe(): string {
    return `file:${this.path}`;
  }
}

export type LocalYamlRegistryRepositoryOptions = {
  path: string;
  parseOpts: ParseOptions;
  disableAutoRefresh?: boolean;
};

export class LocalYamlRegistryRepository extends YamlRegistryRepository {
  constructor(opts: LocalYamlRegistryRepositoryOptions) {
    super({
      source: new LocalYamlSource({ path: opts.path }),
      parseOpts: opts.parseOpts,
      ...(opts.disableAutoRefresh !== undefined ? { disableAutoRefresh: opts.disableAutoRefresh } : {}),
    });
  }
}
