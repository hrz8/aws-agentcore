import type { Scope } from '@repo/kit/identity';

import type {
  BranchOutcome,
  DocumentSummary,
  FileDocumentEntry,
  IngestionJob,
  PresignedUploadTicket,
  SignedResourceUrl,
  WebDocumentInput,
} from '../../domain/index.js';
import { IngestStatus } from '../../domain/index.js';
import {
  assertS3KeyInScope,
  assertS3UriInScope,
  assertWebDocIdInScope,
} from '../../domain/scope-guards.js';
import {
  KbConflictError,
  KbNotConfiguredError,
  KbNotFoundError,
  KbValidationError,
} from '../../errors.js';
import type {
  BranchInput,
  KbRepository,
  PresignDownloadInput,
  PresignUploadInput,
} from '../../interface.js';

const MEMORY_BUCKET = 'memory-bucket';

type ScopedKey = string;
function scopeKey(scope: Scope): ScopedKey {
  return `${scope.tenantId}/${scope.agentId}/${scope.version}`;
}
function webDocPrefix(scope: Scope): string {
  return `${scope.tenantId}__${scope.agentId}__${scope.version}__`;
}

type StoredFile = { key: string; contentType: string; sizeGuess: number; uploadedAt: Date };
type StoredWebDoc = DocumentSummary;

export type MemoryKbRepositoryOptions = {
  webDataSourceConfigured?: boolean;
};

export class MemoryKbRepository implements KbRepository {
  private readonly files = new Map<ScopedKey, Map<string, StoredFile>>();
  private readonly webDocs = new Map<ScopedKey, Map<string, StoredWebDoc>>();
  private readonly ingestionJobs = new Map<string, IngestionJob>();
  private jobCounter = 0;
  private readonly webConfigured: boolean;

  constructor(opts: MemoryKbRepositoryOptions = {}) {
    this.webConfigured = opts.webDataSourceConfigured ?? true;
  }

  async presignUpload(scope: Scope, input: PresignUploadInput): Promise<PresignedUploadTicket> {
    if (!input.filename || input.filename.includes('/')) {
      throw new KbValidationError('invalid filename');
    }
    const key = `kb/${scopeKey(scope)}/${input.filename}`;
    const sidecarKey = `${key}.metadata.json`;
    const ttl = input.ttlSeconds ?? 300;
    const bucket = this.files.get(scopeKey(scope)) ?? new Map();
    bucket.set(key, {
      key,
      contentType: input.contentType,
      sizeGuess: 0,
      uploadedAt: new Date(),
    });
    this.files.set(scopeKey(scope), bucket);
    return {
      key,
      sidecarKey,
      fileUploadUrl: `memory://put/${key}?ttl=${ttl}`,
      sidecarUploadUrl: `memory://put/${sidecarKey}?ttl=${ttl}`,
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

  async listDocuments(scope: Scope): Promise<FileDocumentEntry[]> {
    const bucket = this.files.get(scopeKey(scope));
    if (!bucket) {
      return [];
    }
    return [...bucket.values()].map((f) => ({
      key: f.key,
      filename: f.key.split('/').pop() ?? f.key,
      size: f.sizeGuess,
      lastModified: f.uploadedAt.toISOString(),
    }));
  }

  async deleteDocument(scope: Scope, key: string): Promise<void> {
    assertS3KeyInScope(scope, key);
    if (key.endsWith('.metadata.json')) {
      throw new KbValidationError('cannot delete sidecar directly');
    }
    const bucket = this.files.get(scopeKey(scope));
    if (!bucket || !bucket.has(key)) {
      throw new KbNotFoundError(`unknown document: ${key}`);
    }
    bucket.delete(key);
  }

  async presignDownload(scope: Scope, input: PresignDownloadInput): Promise<SignedResourceUrl> {
    if (!input.uri.startsWith('s3://')) {
      throw new KbValidationError('uri must be s3://…');
    }
    assertS3UriInScope(MEMORY_BUCKET, scope, input.uri);
    const ttl = input.ttlSeconds ?? 300;
    const page = input.page ? `#page=${input.page}` : '';
    return { url: `${input.uri}?sig=fake&ttl=${ttl}${page}`, expiresIn: ttl };
  }

  async startIngestion(_scope: Scope): Promise<IngestionJob> {
    this.jobCounter += 1;
    const job: IngestionJob = {
      ingestionJobId: `mem-job-${this.jobCounter}`,
      status: IngestStatus.Complete,
      statistics: { numberOfNewDocumentsIndexed: 0 },
    };
    this.ingestionJobs.set(job.ingestionJobId!, job);
    return job;
  }

  async getIngestionJob(_scope: Scope, jobId: string): Promise<IngestionJob> {
    const job = this.ingestionJobs.get(jobId);
    if (!job) {
      throw new KbNotFoundError(`unknown ingestion job: ${jobId}`);
    }
    return job;
  }

  async ingestWebDocument(scope: Scope, doc: WebDocumentInput): Promise<DocumentSummary> {
    if (!this.webConfigured) {
      throw new KbNotConfiguredError('web data source not configured for this KB stage');
    }
    const documentId = `${webDocPrefix(scope)}${doc.contentHash}`;
    const summary: DocumentSummary = {
      documentId,
      status: IngestStatus.Complete,
      updatedAt: new Date(),
      sourceUrl: doc.sourceUrl,
      title: doc.title,
      fetchedAt: doc.fetchedAt,
    };
    const bucket = this.webDocs.get(scopeKey(scope)) ?? new Map();
    bucket.set(documentId, summary);
    this.webDocs.set(scopeKey(scope), bucket);
    return summary;
  }

  async listWebDocuments(scope: Scope): Promise<DocumentSummary[]> {
    if (!this.webConfigured) {
      throw new KbNotConfiguredError('web data source not configured for this KB stage');
    }
    const bucket = this.webDocs.get(scopeKey(scope));
    if (!bucket) {
      return [];
    }
    return [...bucket.values()];
  }

  async deleteWebDocument(scope: Scope, docId: string): Promise<DocumentSummary> {
    if (!this.webConfigured) {
      throw new KbNotConfiguredError('web data source not configured for this KB stage');
    }
    assertWebDocIdInScope(scope, docId);
    const bucket = this.webDocs.get(scopeKey(scope));
    const existing = bucket?.get(docId);
    if (!existing) {
      throw new KbNotFoundError(`unknown web document: ${docId}`);
    }
    bucket!.delete(docId);
    return { ...existing, status: 'DELETING' };
  }

  async branch(scope: Scope, input: BranchInput): Promise<BranchOutcome> {
    if (input.toVersion === scope.version) {
      throw new KbValidationError(`target version equals source (${input.toVersion})`);
    }
    const sourceKey = scopeKey(scope);
    const targetKey = scopeKey({ ...scope, version: input.toVersion });
    const sourceBucket = this.files.get(sourceKey);
    if (!sourceBucket || sourceBucket.size === 0) {
      throw new KbValidationError(`no objects under source prefix kb/${sourceKey}/`);
    }
    const targetBucket = this.files.get(targetKey);
    if (targetBucket && targetBucket.size > 0) {
      throw new KbConflictError(
        `target prefix kb/${targetKey}/ is not empty (${targetBucket.size} objects).`,
      );
    }
    const newBucket = new Map<string, StoredFile>();
    let filesCopied = 0;
    for (const [key, file] of sourceBucket) {
      const newKey = key.replace(`kb/${sourceKey}/`, `kb/${targetKey}/`);
      newBucket.set(newKey, { ...file, key: newKey });
      filesCopied += 1;
    }
    this.files.set(targetKey, newBucket);

    const ingestionJob = input.sync !== false
      ? await this.startIngestion({ ...scope, version: input.toVersion })
      : null;
    return {
      sourceVersion: scope.version,
      targetVersion: input.toVersion,
      filesCopied,
      sidecarsRewritten: filesCopied,
      sourcePrefix: `kb/${sourceKey}/`,
      targetPrefix: `kb/${targetKey}/`,
      webKbCloned: false,
      webKbNote: 'Web KB custom docs are not cloned; re-ingest URLs under the new agent version.',
      ingestionJob,
    };
  }
}
