import {
  BedrockAgentClient,
  DeleteKnowledgeBaseDocumentsCommand,
  GetIngestionJobCommand,
  IngestKnowledgeBaseDocumentsCommand,
  ListKnowledgeBaseDocumentsCommand,
  StartIngestionJobCommand,
  type IngestionJob,
  type KnowledgeBaseDocumentDetail,
} from '@aws-sdk/client-bedrock-agent';

export { BedrockAgentClient };

export function createBedrockAgentClient(region: string): BedrockAgentClient {
  return new BedrockAgentClient({ region });
}

export type IngestionJobStatistics = {
  numberOfDocumentsScanned?: number;
  numberOfMetadataDocumentsScanned?: number;
  numberOfNewDocumentsIndexed?: number;
  numberOfModifiedDocumentsIndexed?: number;
  numberOfMetadataDocumentsModified?: number;
  numberOfDocumentsDeleted?: number;
  numberOfDocumentsFailed?: number;
};

export type IngestionJobSummary = {
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

export type IngestTextDocumentInput = {
  knowledgeBaseId: string;
  dataSourceId: string;
  documentId: string;
  text: string;
  metadata: Record<string, string>;
};

export async function startIngestionJob(
  bedrock: BedrockAgentClient,
  knowledgeBaseId: string,
  dataSourceId: string,
): Promise<IngestionJobSummary> {
  const out = await bedrock.send(new StartIngestionJobCommand({ knowledgeBaseId, dataSourceId }));
  return toJobSummary(out.ingestionJob);
}

export async function getIngestionJob(
  bedrock: BedrockAgentClient,
  knowledgeBaseId: string,
  dataSourceId: string,
  ingestionJobId: string,
): Promise<IngestionJobSummary> {
  const out = await bedrock.send(new GetIngestionJobCommand({ knowledgeBaseId, dataSourceId, ingestionJobId }));
  return toJobSummary(out.ingestionJob);
}

export async function ingestTextDocument(
  bedrock: BedrockAgentClient,
  input: IngestTextDocumentInput,
): Promise<DocumentSummary> {
  const out = await bedrock.send(new IngestKnowledgeBaseDocumentsCommand({
    knowledgeBaseId: input.knowledgeBaseId,
    dataSourceId: input.dataSourceId,
    documents: [{
      metadata: {
        type: 'IN_LINE_ATTRIBUTE',
        inlineAttributes: Object.entries(input.metadata).map(([key, value]) => ({
          key,
          value: {
            type: 'STRING',
            stringValue: value,
          },
        })),
      },
      content: {
        dataSourceType: 'CUSTOM',
        custom: {
          customDocumentIdentifier: { id: input.documentId },
          sourceType: 'IN_LINE',
          inlineContent: {
            type: 'TEXT',
            textContent: { data: input.text },
          },
        },
      },
    }],
  }));
  return toDocSummary(out.documentDetails?.[0], input.documentId);
}

export async function deleteCustomDocument(
  bedrock: BedrockAgentClient,
  knowledgeBaseId: string,
  dataSourceId: string,
  documentId: string,
): Promise<DocumentSummary> {
  const out = await bedrock.send(new DeleteKnowledgeBaseDocumentsCommand({
    knowledgeBaseId, dataSourceId,
    documentIdentifiers: [
      {
        dataSourceType: 'CUSTOM',
        custom: { id: documentId },
      },
    ],
  }));
  return toDocSummary(out.documentDetails?.[0], documentId);
}

export async function listCustomDocuments(
  bedrock: BedrockAgentClient,
  knowledgeBaseId: string,
  dataSourceId: string,
  maxResults = 200,
): Promise<DocumentSummary[]> {
  const summaries: DocumentSummary[] = [];
  let nextToken: string | undefined;
  do {
    const out = await bedrock.send(new ListKnowledgeBaseDocumentsCommand({
      knowledgeBaseId, dataSourceId,
      maxResults: Math.min(100, maxResults - summaries.length),
      nextToken,
    }));
    for (const d of out.documentDetails ?? []) {
      const id = d.identifier?.custom?.id ?? '';
      if (id) {
        summaries.push(toDocSummary(d, id));
      }
      if (summaries.length >= maxResults) {
        return summaries;
      }
    }
    nextToken = out.nextToken;
  } while (nextToken);
  return summaries;
}

function toJobSummary(job: IngestionJob | undefined): IngestionJobSummary {
  const s = job?.statistics;
  return {
    ingestionJobId: job?.ingestionJobId,
    status: job?.status,
    statistics: s
      ? {
          numberOfDocumentsScanned: s.numberOfDocumentsScanned,
          numberOfMetadataDocumentsScanned: s.numberOfMetadataDocumentsScanned,
          numberOfNewDocumentsIndexed: s.numberOfNewDocumentsIndexed,
          numberOfModifiedDocumentsIndexed: s.numberOfModifiedDocumentsIndexed,
          numberOfMetadataDocumentsModified: s.numberOfMetadataDocumentsModified,
          numberOfDocumentsDeleted: s.numberOfDocumentsDeleted,
          numberOfDocumentsFailed: s.numberOfDocumentsFailed,
        }
      : undefined,
    failureReasons: job?.failureReasons,
  };
}

function toDocSummary(detail: KnowledgeBaseDocumentDetail | undefined, documentId: string): DocumentSummary {
  return {
    documentId,
    status: detail?.status,
    statusReason: detail?.statusReason,
    updatedAt: detail?.updatedAt,
  };
}
