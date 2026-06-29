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

import { AWS_REGION } from '../../../config.js';

const client = new BedrockAgentClient({ region: AWS_REGION });

export type IngestionJobSummary = {
  ingestionJobId: string | undefined;
  status: IngestionJob['status'];
  statistics?: IngestionJob['statistics'];
  failureReasons?: string[];
};

export async function startIngestionJob(
  knowledgeBaseId: string,
  dataSourceId: string,
): Promise<IngestionJobSummary> {
  const out = await client.send(new StartIngestionJobCommand({
    knowledgeBaseId,
    dataSourceId,
  }));
  return toJobSummary(out.ingestionJob);
}

export async function getIngestionJob(
  knowledgeBaseId: string,
  dataSourceId: string,
  ingestionJobId: string,
): Promise<IngestionJobSummary> {
  const out = await client.send(new GetIngestionJobCommand({
    knowledgeBaseId,
    dataSourceId,
    ingestionJobId,
  }));
  return toJobSummary(out.ingestionJob);
}

function toJobSummary(job: IngestionJob | undefined): IngestionJobSummary {
  return {
    ingestionJobId: job?.ingestionJobId,
    status: job?.status,
    statistics: job?.statistics,
    failureReasons: job?.failureReasons,
  };
}

export type IngestTextDocumentInput = {
  knowledgeBaseId: string;
  dataSourceId: string;
  documentId: string;
  text: string;
  metadata: Record<string, string>;
};

export type DocumentSummary = {
  documentId: string;
  status: KnowledgeBaseDocumentDetail['status'];
  statusReason?: string;
  updatedAt?: Date;
};

export async function ingestTextDocument(input: IngestTextDocumentInput): Promise<DocumentSummary> {
  const out = await client.send(new IngestKnowledgeBaseDocumentsCommand({
    knowledgeBaseId: input.knowledgeBaseId,
    dataSourceId: input.dataSourceId,
    documents: [{
      metadata: {
        type: 'IN_LINE_ATTRIBUTE',
        inlineAttributes: Object.entries(input.metadata).map(([key, value]) => ({
          key,
          value: { type: 'STRING', stringValue: value },
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
  knowledgeBaseId: string,
  dataSourceId: string,
  documentId: string,
): Promise<DocumentSummary> {
  const out = await client.send(new DeleteKnowledgeBaseDocumentsCommand({
    knowledgeBaseId,
    dataSourceId,
    documentIdentifiers: [{
      dataSourceType: 'CUSTOM',
      custom: { id: documentId },
    }],
  }));
  return toDocSummary(out.documentDetails?.[0], documentId);
}

export async function listCustomDocuments(
  knowledgeBaseId: string,
  dataSourceId: string,
  maxResults = 200,
): Promise<DocumentSummary[]> {
  const summaries: DocumentSummary[] = [];
  let nextToken: string | undefined;
  do {
    const out = await client.send(new ListKnowledgeBaseDocumentsCommand({
      knowledgeBaseId,
      dataSourceId,
      maxResults: Math.min(100, maxResults - summaries.length),
      nextToken,
    }));
    for (const d of out.documentDetails ?? []) {
      const id = d.identifier?.custom?.id ?? '';
      if (id) summaries.push(toDocSummary(d, id));
      if (summaries.length >= maxResults) return summaries;
    }
    nextToken = out.nextToken;
  } while (nextToken);
  return summaries;
}

function toDocSummary(detail: KnowledgeBaseDocumentDetail | undefined, documentId: string): DocumentSummary {
  return {
    documentId,
    status: detail?.status,
    statusReason: detail?.statusReason,
    updatedAt: detail?.updatedAt,
  };
}
