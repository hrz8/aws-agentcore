import type { Scope } from '@repo/kit/identity';
import type { Logger } from '@repo/kit/logger';
import { METADATA_KEYS, rewriteAgentVersion } from '@repo/kit/paths';
import {
  copyObject,
  createS3Client,
  deleteObjects,
  getObjectText,
  listObjects,
  NoSuchKey,
  parseS3Uri,
  presignGetObject,
  presignPutObject,
  putObject,
  type S3Client,
} from '@repo/kit/aws/s3';
import {
  createBedrockAgentClient,
  deleteCustomDocument,
  getIngestionJob as awsGetIngestionJob,
  ingestTextDocument,
  listCustomDocuments,
  startIngestionJob as awsStartIngestionJob,
  type BedrockAgentClient,
} from '@repo/kit/aws/bedrock';

import type {
  BranchOutcome,
  DocumentSummary,
  FileDocumentEntry,
  IngestionJob,
  PresignedUploadTicket,
  SignedResourceUrl,
  WebDocumentInput,
} from '../../domain/index.js';
import { assertS3KeyInScope, assertS3UriInScope, assertWebDocIdInScope } from '../../domain/scope-guards.js';
import {
  KbConflictError,
  KbNotConfiguredError,
  KbValidationError,
} from '../../errors.js';
import type {
  BranchInput,
  KbRepository,
  KbRepositoryOptions,
  PresignDownloadInput,
  PresignUploadInput,
} from '../../interface.js';

import {
  composeWebDocId,
  kbPrefixFor,
  sanitizeFilename,
  webDocIdPrefix,
  webManifestKey,
  webManifestPrefix,
} from './paths.js';

export {
  composeWebDocId,
  kbPrefixFor,
  sanitizeFilename,
  webDocIdPrefix,
} from './paths.js';

type WebManifest = {
  sourceUrl: string;
  title: string;
  fetchedAt: string;
};

const DEFAULT_UPLOAD_TTL_S = 5 * 60;
const DEFAULT_DOWNLOAD_TTL_S = 5 * 60;

export type S3BedrockKbRepositoryOptions = KbRepositoryOptions & {
  region: string;
  uploadsBucket: string;
  kbId: string;
  s3DataSourceId: string;
  webDataSourceId: string | null;
};

type AwsClients = { s3: S3Client; bedrock: BedrockAgentClient };

export class S3BedrockKbRepository implements KbRepository {
  private readonly aws: AwsClients;
  private readonly bucket: string;
  private readonly kbId: string;
  private readonly s3DataSourceId: string;
  private readonly webDataSourceId: string | null;
  private readonly log: Logger | undefined;

  constructor(opts: S3BedrockKbRepositoryOptions) {
    this.aws = {
      s3: createS3Client(opts.region),
      bedrock: createBedrockAgentClient(opts.region),
    };
    this.bucket = opts.uploadsBucket;
    this.kbId = opts.kbId;
    this.s3DataSourceId = opts.s3DataSourceId;
    this.webDataSourceId = opts.webDataSourceId;
    this.log = opts.logger;
  }

  async presignUpload(scope: Scope, input: PresignUploadInput): Promise<PresignedUploadTicket> {
    const ttl = input.ttlSeconds ?? DEFAULT_UPLOAD_TTL_S;
    const safeFilename = sanitizeFilename(input.filename);
    if (!safeFilename) {
      throw new KbValidationError('invalid filename');
    }
    const key = `${kbPrefixFor(scope)}${safeFilename}`;
    const sidecarKey = `${key}.metadata.json`;
    const [fileUploadUrl, sidecarUploadUrl] = await Promise.all([
      presignPutObject(this.aws.s3, this.bucket, key, input.contentType, ttl),
      presignPutObject(this.aws.s3, this.bucket, sidecarKey, 'application/json', ttl),
    ]);
    return {
      key,
      sidecarKey,
      fileUploadUrl,
      sidecarUploadUrl,
      sidecarBody: {
        metadataAttributes: {
          tenant_id: scope.tenantId,
          agent_id: scope.agentId,
          agent_version: scope.version,
        },
      },
      expiresIn: ttl,
    };
  }

  async startIngestion(_scope: Scope): Promise<IngestionJob> {
    return awsStartIngestionJob(this.aws.bedrock, this.kbId, this.s3DataSourceId);
  }

  async getIngestionJob(_scope: Scope, jobId: string): Promise<IngestionJob> {
    return awsGetIngestionJob(this.aws.bedrock, this.kbId, this.s3DataSourceId, jobId);
  }

  async presignDownload(scope: Scope, input: PresignDownloadInput): Promise<SignedResourceUrl> {
    if (!input.uri.startsWith('s3://')) {
      throw new KbValidationError('uri must be s3://…');
    }
    assertS3UriInScope(this.bucket, scope, input.uri);
    const ttl = input.ttlSeconds ?? DEFAULT_DOWNLOAD_TTL_S;
    const { bucket, key } = parseS3Uri(input.uri);
    const base = await presignGetObject(this.aws.s3, bucket, key, ttl, 'inline');
    const url = input.page ? `${base}#page=${input.page}` : base;
    return { url, expiresIn: ttl };
  }

  async listDocuments(scope: Scope): Promise<FileDocumentEntry[]> {
    const prefix = kbPrefixFor(scope);
    const manifestPrefix = webManifestPrefix(scope);
    const objects = await listObjects(this.aws.s3, this.bucket, prefix);
    return objects
      .filter((o) => !o.key.endsWith('.metadata.json'))
      .filter((o) => !o.key.startsWith(manifestPrefix))
      .map((o) => ({
        key: o.key,
        filename: o.key.slice(prefix.length),
        size: o.size,
        lastModified: o.lastModified?.toISOString() ?? null,
      }));
  }

  async deleteDocument(scope: Scope, key: string): Promise<void> {
    assertS3KeyInScope(scope, key);
    if (key.endsWith('.metadata.json')) {
      throw new KbValidationError('cannot delete sidecar directly');
    }
    await deleteObjects(this.aws.s3, this.bucket, [key, `${key}.metadata.json`]);
  }

  async ingestWebDocument(scope: Scope, doc: WebDocumentInput): Promise<DocumentSummary> {
    const webDsId = this.requireWebDs();
    const documentId = composeWebDocId(scope, doc.contentHash);
    const manifest: WebManifest = {
      sourceUrl: doc.sourceUrl,
      title: doc.title,
      fetchedAt: doc.fetchedAt,
    };
    await putObject(this.aws.s3, {
      bucket: this.bucket,
      key: webManifestKey(scope, documentId),
      body: JSON.stringify(manifest),
      contentType: 'application/json',
    });
    const summary = await ingestTextDocument(this.aws.bedrock, {
      knowledgeBaseId: this.kbId,
      dataSourceId: webDsId,
      documentId,
      text: doc.text,
      metadata: {
        [METADATA_KEYS.tenantId]: scope.tenantId,
        [METADATA_KEYS.agentId]: scope.agentId,
        [METADATA_KEYS.agentVersion]: scope.version,
        [METADATA_KEYS.sourceUrl]: doc.sourceUrl,
        [METADATA_KEYS.title]: doc.title,
        [METADATA_KEYS.fetchedAt]: doc.fetchedAt,
      },
    });
    return { ...summary, ...manifest };
  }

  async listWebDocuments(scope: Scope): Promise<DocumentSummary[]> {
    const webDsId = this.requireWebDs();
    const [docs, manifests] = await Promise.all([
      listCustomDocuments(this.aws.bedrock, this.kbId, webDsId),
      this.readWebManifests(scope),
    ]);
    const prefix = webDocIdPrefix(scope);
    return docs
      .filter((d) => d.documentId.startsWith(prefix))
      .map((d) => {
        const manifest = manifests.get(d.documentId);
        return manifest ? { ...d, ...manifest } : d;
      });
  }

  async deleteWebDocument(scope: Scope, docId: string): Promise<DocumentSummary> {
    const webDsId = this.requireWebDs();
    assertWebDocIdInScope(scope, docId);
    const [summary] = await Promise.all([
      deleteCustomDocument(this.aws.bedrock, this.kbId, webDsId, docId),
      deleteObjects(this.aws.s3, this.bucket, [webManifestKey(scope, docId)]),
    ]);
    return summary;
  }

  private async readWebManifests(scope: Scope): Promise<Map<string, WebManifest>> {
    const prefix = webManifestPrefix(scope);
    const objects = await listObjects(this.aws.s3, this.bucket, prefix);
    const entries = await Promise.all(
      objects.map(async (o) => {
        const docId = o.key.slice(prefix.length).replace(/\.json$/, '');
        try {
          const raw = await getObjectText(this.aws.s3, this.bucket, o.key);
          const parsed = JSON.parse(raw) as WebManifest;
          return [docId, parsed] as const;
        } catch (err) {
          if (err instanceof NoSuchKey) return null;
          this.log?.warn?.('kb.web-manifest.read-failed', { key: o.key, err: String(err) });
          return null;
        }
      }),
    );
    return new Map(entries.filter((e): e is readonly [string, WebManifest] => e !== null));
  }

  async branch(scope: Scope, input: BranchInput): Promise<BranchOutcome> {
    if (input.toVersion === scope.version) {
      throw new KbValidationError(`target version equals source (${input.toVersion})`);
    }
    const targetScope: Scope = { ...scope, version: input.toVersion };
    const sourcePrefix = kbPrefixFor(scope);
    const targetPrefix = kbPrefixFor(targetScope);

    // TODO: not atomic — concurrent branches to the same toVersion both
    // pass the empty-target check and write. Guard with a .branch-lock
    // marker written using IfNoneMatch: '*'.
    const existingAtTarget = await listObjects(this.aws.s3, this.bucket, targetPrefix);
    if (existingAtTarget.length > 0) {
      throw new KbConflictError(
        `target prefix ${targetPrefix} is not empty (${existingAtTarget.length} objects). Delete first or choose another version.`,
      );
    }
    const sourceObjects = await listObjects(this.aws.s3, this.bucket, sourcePrefix);
    if (sourceObjects.length === 0) {
      throw new KbValidationError(`no objects under source prefix ${sourcePrefix}`);
    }

    let filesCopied = 0;
    let sidecarsRewritten = 0;
    for (const obj of sourceObjects) {
      const rel = obj.key.slice(sourcePrefix.length);
      const targetKey = `${targetPrefix}${rel}`;
      if (obj.key.endsWith('.metadata.json')) {
        const raw = await getObjectText(this.aws.s3, this.bucket, obj.key);
        const rewritten = rewriteAgentVersion(raw, input.toVersion);
        await putObject(this.aws.s3, {
          bucket: this.bucket,
          key: targetKey,
          body: rewritten,
          contentType: 'application/json',
        });
        sidecarsRewritten += 1;
      } else {
        await copyObject(this.aws.s3, this.bucket, obj.key, targetKey);
      }
      filesCopied += 1;
    }

    let ingestionJob: IngestionJob | null = null;
    if (input.sync !== false) {
      try {
        ingestionJob = await awsStartIngestionJob(
          this.aws.bedrock,
          this.kbId,
          this.s3DataSourceId,
        );
      } catch (err) {
        this.log?.warn('kb.branch.sync-failed', {
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return {
      sourceVersion: scope.version,
      targetVersion: input.toVersion,
      filesCopied,
      sidecarsRewritten,
      sourcePrefix,
      targetPrefix,
      webKbCloned: false,
      webKbNote: 'Web KB custom docs are not cloned; re-ingest URLs under the new agent version.',
      ingestionJob,
    };
  }

  private requireWebDs(): string {
    if (!this.webDataSourceId) {
      throw new KbNotConfiguredError('web data source not configured for this KB stage');
    }
    return this.webDataSourceId;
  }
}
