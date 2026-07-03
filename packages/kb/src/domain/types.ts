export const IngestStatus = {
  Starting: 'STARTING',
  InProgress: 'IN_PROGRESS',
  Complete: 'COMPLETE',
  Failed: 'FAILED',
  Stopping: 'STOPPING',
  Stopped: 'STOPPED',
} as const;
export type IngestStatus = typeof IngestStatus[keyof typeof IngestStatus];

export type IngestionJobStatistics = {
  numberOfDocumentsScanned?: number;
  numberOfMetadataDocumentsScanned?: number;
  numberOfNewDocumentsIndexed?: number;
  numberOfModifiedDocumentsIndexed?: number;
  numberOfMetadataDocumentsModified?: number;
  numberOfDocumentsDeleted?: number;
  numberOfDocumentsFailed?: number;
};

export type IngestionJob = {
  ingestionJobId: string | undefined;
  status: string | undefined;
  statistics?: IngestionJobStatistics;
  failureReasons?: string[];
};

export type DocumentSummary = {
  documentId: string;
  status: string | undefined;
  statusReason?: string;
  updatedAt?: Date;
};

export type FileDocumentEntry = {
  key: string;
  filename: string;
  size: number;
  lastModified: string | null;
};

export type PresignedUploadTicket = {
  key: string;
  sidecarKey: string;
  fileUploadUrl: string;
  sidecarUploadUrl: string;
  sidecarBody: {
    metadataAttributes: {
      tenant_id: string;
      agent_id: string;
      agent_version: string;
    };
  };
  expiresIn: number;
};

export type SignedResourceUrl = {
  url: string;
  expiresIn: number;
};

export type WebDocumentInput = {
  text: string;
  contentHash: string;
  sourceUrl: string;
  title: string;
  fetchedAt: string;
};

export type BranchOutcome = {
  sourceVersion: string;
  targetVersion: string;
  filesCopied: number;
  sidecarsRewritten: number;
  sourcePrefix: string;
  targetPrefix: string;
  webKbCloned: boolean;
  webKbNote: string;
  ingestionJob: IngestionJob | null;
};
