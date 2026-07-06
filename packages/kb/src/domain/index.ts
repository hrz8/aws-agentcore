export {
  IngestStatus,
  KbDocStatus,
  type BranchOutcome,
  type DocumentSummary,
  type FileDocumentEntry,
  type IngestionJob,
  type IngestionJobStatistics,
  type PresignedUploadTicket,
  type SignedResourceUrl,
  type WebDocumentInput,
} from './types.js';

export {
  assertS3KeyInScope,
  assertS3UriInScope,
  assertWebDocIdInScope,
} from './scope-guards.js';
