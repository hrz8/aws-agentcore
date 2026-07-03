import {
  createS3Client,
  getObject,
  NoSuchKey,
  putObject,
  type S3Client,
} from '@repo/kit/aws/s3';

import { RegistryValidationError } from '../../errors.js';
import type { RawTextEditable, RegistryRepository } from '../../interface.js';

import { S3YamlAgentRepo } from './agents.js';
import { S3YamlMcpServerRepo } from './mcp.js';
import {
  parseRegistryYaml,
  validateRegistryText,
  type ParseOptions,
  type RegistryIndexes,
} from './parse.js';
import { S3YamlTenantRepo } from './tenants.js';
import { S3YamlVarRepo } from './vars.js';

const REFRESH_TTL_MS = 120_000;

export type S3YamlRegistryRepositoryOptions = {
  bucket: string;
  key: string;
  region: string;
  parseOpts: ParseOptions;
  disableAutoRefresh?: boolean;
};

export class S3YamlRegistryRepository implements RegistryRepository {
  private indexes: RegistryIndexes | null = null;
  private etag: string | undefined;
  private lastRefreshedAt = 0;
  private inFlight: Promise<void> | null = null;

  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly key: string;
  private readonly parseOpts: ParseOptions;
  private readonly disableAutoRefresh: boolean;

  readonly tenants: S3YamlTenantRepo;
  readonly agents: S3YamlAgentRepo;
  readonly mcpServers: S3YamlMcpServerRepo;
  readonly vars: S3YamlVarRepo;
  readonly rawText: RawTextEditable;

  constructor(opts: S3YamlRegistryRepositoryOptions) {
    this.bucket = opts.bucket;
    this.key = opts.key;
    this.parseOpts = opts.parseOpts;
    this.disableAutoRefresh = opts.disableAutoRefresh ?? false;
    this.s3 = createS3Client(opts.region);

    const getIndex = (): RegistryIndexes => {
      if (!this.indexes) {
        throw new Error('S3YamlRegistryRepository: refresh() not called');
      }
      if (!this.disableAutoRefresh) {
        this.maybeRefreshInBackground();
      }
      return this.indexes;
    };

    this.tenants = new S3YamlTenantRepo(getIndex);
    this.mcpServers = new S3YamlMcpServerRepo(getIndex);
    this.vars = new S3YamlVarRepo(getIndex);
    this.agents = new S3YamlAgentRepo({
      getIndex,
      readRaw: () => this.readRaw(),
      writeRaw: (text) => this.writeRaw(text),
    });

    this.rawText = {
      read: () => this.readRaw(),
      write: (text) => this.writeRaw(text),
    };
  }

  async refresh(): Promise<void> {
    await this.doRefresh({ initial: this.indexes === null });
  }

  private async doRefresh(opts: { initial: boolean }): Promise<void> {
    try {
      const res = await getObject(this.s3, this.bucket, this.key, { ifNoneMatch: this.etag });
      if (res.kind === 'not-modified') {
        this.lastRefreshedAt = Date.now();
        return;
      }
      this.indexes = parseRegistryYaml(res.text, this.parseOpts);
      this.etag = res.etag;
      this.lastRefreshedAt = Date.now();
      console.info(
        `[registry/s3-yaml] loaded s3://${this.bucket}/${this.key} etag=${this.etag ?? 'none'}`,
      );
    } catch (err) {
      if (err instanceof NoSuchKey && opts.initial) {
        throw new Error(
          `registry missing: s3://${this.bucket}/${this.key} does not exist.`,
        );
      }
      if (opts.initial) {
        throw err;
      }
      console.warn(
        `[registry/s3-yaml] refresh failed (staying on cached): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private maybeRefreshInBackground(): void {
    if (Date.now() - this.lastRefreshedAt < REFRESH_TTL_MS) {
      return;
    }
    if (this.inFlight) {
      return;
    }
    this.inFlight = this
      .doRefresh({ initial: false })
      .finally(() => { this.inFlight = null; });
  }

  private async readRaw(): Promise<{ text: string; etag: string | undefined }> {
    const res = await getObject(this.s3, this.bucket, this.key);
    if (res.kind !== 'ok') {
      throw new Error(`unexpected result from getObject: ${res.kind}`);
    }
    return {
      text: res.text,
      etag: res.etag,
    };
  }

  private async writeRaw(text: string): Promise<{ etag: string | undefined }> {
    const result = validateRegistryText(text, this.parseOpts);
    if (!result.ok) {
      const detail = result.error.detail ? ` (${JSON.stringify(result.error.detail)})` : '';
      throw new RegistryValidationError(`${result.error.kind}: ${result.error.message}${detail}`);
    }
    const put = await putObject(this.s3, {
      bucket: this.bucket,
      key: this.key,
      body: text,
      contentType: 'application/yaml',
    });
    this.indexes = parseRegistryYaml(text, this.parseOpts);
    this.etag = put.etag;
    this.lastRefreshedAt = Date.now();
    return {
      etag: put.etag,
    };
  }
}
