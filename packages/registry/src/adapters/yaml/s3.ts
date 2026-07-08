import {
  createS3Client,
  getObject,
  NoSuchKey,
  putObject,
  type S3Client,
} from '@repo/kit/aws/s3';

import type { ParseOptions } from './parse.js';
import { YamlRegistryRepository } from './registry.js';
import type { YamlSource, YamlSourceReadResult } from './source.js';

export type S3YamlSourceOptions = {
  bucket: string;
  key: string;
  region: string;
};

export class S3YamlSource implements YamlSource {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly key: string;

  constructor(opts: S3YamlSourceOptions) {
    this.bucket = opts.bucket;
    this.key = opts.key;
    this.s3 = createS3Client(opts.region);
  }

  async read(opts?: { ifNoneMatch?: string }): Promise<YamlSourceReadResult> {
    try {
      const res = await getObject(
        this.s3,
        this.bucket,
        this.key,
        opts?.ifNoneMatch ? { ifNoneMatch: opts.ifNoneMatch } : undefined,
      );
      if (res.kind === 'not-modified') {
        return { kind: 'not-modified' };
      }
      return { kind: 'ok', text: res.text, etag: res.etag };
    } catch (err) {
      if (err instanceof NoSuchKey) {
        throw new Error(`registry missing: ${this.describe()} does not exist.`);
      }
      throw err;
    }
  }

  async write(text: string): Promise<{ etag: string | undefined }> {
    const put = await putObject(this.s3, {
      bucket: this.bucket,
      key: this.key,
      body: text,
      contentType: 'application/yaml',
    });
    return { etag: put.etag };
  }

  describe(): string {
    return `s3://${this.bucket}/${this.key}`;
  }
}

export type S3YamlRegistryRepositoryOptions = {
  bucket: string;
  key: string;
  region: string;
  parseOpts: ParseOptions;
  disableAutoRefresh?: boolean;
};

export class S3YamlRegistryRepository extends YamlRegistryRepository {
  constructor(opts: S3YamlRegistryRepositoryOptions) {
    super({
      source: new S3YamlSource({ bucket: opts.bucket, key: opts.key, region: opts.region }),
      parseOpts: opts.parseOpts,
      ...(opts.disableAutoRefresh !== undefined ? { disableAutoRefresh: opts.disableAutoRefresh } : {}),
    });
  }
}
