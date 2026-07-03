export { IngestStatus as IngestionJobStatus } from '@repo/kb/domain';
export type {
  FileDocumentEntry as DocumentSummary,
  IngestionJob as IngestionJobInfo,
  PresignedUploadTicket as UploadPresignResponse,
} from '@repo/kb/domain';

import type { CrawlSitemapResult, IngestUrlResult } from '@repo/kb';
export type AddWebUrlResult = IngestUrlResult | CrawlSitemapResult;

export type WebDocumentSummary = {
  documentId: string;
  status?: string;
  statusReason?: string;
  updatedAt?: Date | string;
};
