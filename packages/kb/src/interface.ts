import type { Scope } from '@repo/kit/identity';
import type { Logger } from '@repo/kit/logger';

import type {
  BranchOutcome,
  DocumentSummary,
  FileDocumentEntry,
  IngestionJob,
  PresignedUploadTicket,
  SignedResourceUrl,
  WebDocumentInput,
} from './domain/index.js';

export type KbRepositoryOptions = {
  logger?: Logger;
};

export type PresignUploadInput = {
  filename: string;
  contentType: string;
  ttlSeconds?: number;
};

export type PresignDownloadInput = {
  uri: string;
  ttlSeconds?: number;
  page?: number;
};

export type BranchInput = {
  toVersion: string;
  sync?: boolean;
};

export interface KbRepository {
  presignUpload(scope: Scope, input: PresignUploadInput): Promise<PresignedUploadTicket>;
  listDocuments(scope: Scope): Promise<FileDocumentEntry[]>;
  deleteDocument(scope: Scope, key: string): Promise<void>;
  presignDownload(scope: Scope, input: PresignDownloadInput): Promise<SignedResourceUrl>;

  startIngestion(scope: Scope): Promise<IngestionJob>;
  getIngestionJob(scope: Scope, jobId: string): Promise<IngestionJob>;

  ingestWebDocument(scope: Scope, doc: WebDocumentInput): Promise<DocumentSummary>;

  listWebDocuments(scope: Scope): Promise<DocumentSummary[]>;
  deleteWebDocument(scope: Scope, docId: string): Promise<DocumentSummary>;
  getWebManifest(scope: Scope, docId: string): Promise<{
    sourceUrl: string;
    title: string;
    fetchedAt: string;
    contentHash: string;
    text?: string;
  } | null>;

  branch(scope: Scope, input: BranchInput): Promise<BranchOutcome>;
  deleteScope(scope: Scope): Promise<{ filesDeleted: number; webDocsDeleted: number }>;
}
