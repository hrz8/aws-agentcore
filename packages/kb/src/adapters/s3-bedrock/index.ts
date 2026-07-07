import type { Scope } from '@repo/kit/identity';
import type { Logger } from '@repo/kit/logger';
import { METADATA_KEYS, rewriteAgentVersion } from '@repo/kit/paths';
import {
  copyObject,
  createS3Client,
  deleteObjects,
  deletePrefix,
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
  contentHash: string;
  text?: string;
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
      contentHash: doc.contentHash,
      text: doc.text,
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
    return {
      ...summary,
      sourceUrl: manifest.sourceUrl,
      title: manifest.title,
      fetchedAt: manifest.fetchedAt,
    };
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
        if (!manifest) return d;
        return {
          ...d,
          sourceUrl: manifest.sourceUrl,
          title: manifest.title,
          fetchedAt: manifest.fetchedAt,
        };
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

  async getWebManifest(scope: Scope, docId: string): Promise<WebManifest | null> {
    assertWebDocIdInScope(scope, docId);
    try {
      const raw = await getObjectText(this.aws.s3, this.bucket, webManifestKey(scope, docId));
      return JSON.parse(raw) as WebManifest;
    } catch (err) {
      if (err instanceof NoSuchKey) return null;
      throw err;
    }
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
    const sourceManifestPrefix = webManifestPrefix(scope);

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

    let filesCopied = 0;
    let sidecarsRewritten = 0;
    for (const obj of sourceObjects) {
      if (obj.key.startsWith(sourceManifestPrefix)) continue;
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

    let webDocsCloned = 0;
    let webDocsSkipped = 0;
    if (this.webDataSourceId) {
      const manifests = await this.readWebManifests(scope);
      for (const manifest of manifests.values()) {
        if (!manifest.text) {
          webDocsSkipped += 1;
          this.log?.warn?.('kb.branch.web-doc-skipped-no-text', {
            sourceUrl: manifest.sourceUrl,
          });
          continue;
        }
        try {
          await this.ingestWebDocument(targetScope, {
            text: manifest.text,
            contentHash: manifest.contentHash,
            sourceUrl: manifest.sourceUrl,
            title: manifest.title,
            fetchedAt: manifest.fetchedAt,
          });
          webDocsCloned += 1;
        } catch (err) {
          webDocsSkipped += 1;
          this.log?.warn?.('kb.branch.web-doc-clone-failed', {
            sourceUrl: manifest.sourceUrl,
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }
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
      webKbCloned: webDocsCloned > 0,
      webKbNote: webDocsSkipped > 0
        ? `Cloned ${webDocsCloned} web docs; skipped ${webDocsSkipped} (missing stored text — refresh them in the source version, then re-branch).`
        : `Cloned ${webDocsCloned} web docs.`,
      ingestionJob,
    };
  }

  async deleteScope(scope: Scope): Promise<{ filesDeleted: number; webDocsDeleted: number }> {
    let webDocsDeleted = 0;
    if (this.webDataSourceId) {
      const docs = await this.listWebDocuments(scope);
      for (const d of docs) {
        try {
          await deleteCustomDocument(this.aws.bedrock, this.kbId, this.webDataSourceId, d.documentId);
          webDocsDeleted += 1;
        } catch (err) {
          this.log?.warn?.('kb.delete-scope.bedrock-delete-failed', {
            docId: d.documentId,
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
    const filesDeleted = await deletePrefix(this.aws.s3, this.bucket, kbPrefixFor(scope));
    return { filesDeleted, webDocsDeleted };
  }

  private requireWebDs(): string {
    if (!this.webDataSourceId) {
      throw new KbNotConfiguredError('web data source not configured for this KB stage');
    }
    return this.webDataSourceId;
  }
}
