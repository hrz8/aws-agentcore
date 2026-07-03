import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
  type KnowledgeBaseRetrievalResult,
  type RetrievalFilter,
} from '@aws-sdk/client-bedrock-agent-runtime';

export { BedrockAgentRuntimeClient };
export type { RetrievalFilter };

export const SOURCE_URI_METADATA_KEY = 'x-amz-bedrock-kb-source-uri';
export const DATA_SOURCE_ID_METADATA_KEY = 'x-amz-bedrock-kb-data-source-id';
const PAGE_NUMBER_METADATA_KEY = 'x-amz-bedrock-kb-document-page-number';

export function createBedrockAgentRuntimeClient(region: string): BedrockAgentRuntimeClient {
  return new BedrockAgentRuntimeClient({ region });
}

export type RetrievedChunk = {
  text: string;
  score: number;
  uri: string;
  page: number | null;
  metadata: Record<string, unknown>;
};

export type RetrieveOptions = {
  readonly kbId: string;
  readonly query: string;
  readonly maxResults: number;
  readonly filter: RetrievalFilter;
};

export async function retrieve(
  client: BedrockAgentRuntimeClient,
  opts: RetrieveOptions,
): Promise<RetrievedChunk[]> {
  const cmd = new RetrieveCommand({
    knowledgeBaseId: opts.kbId,
    retrievalQuery: { text: opts.query },
    retrievalConfiguration: {
      vectorSearchConfiguration: {
        numberOfResults: opts.maxResults,
        filter: opts.filter,
      },
    },
  });
  const res = await client.send(cmd);
  return (res.retrievalResults ?? []).map(toChunk);
}

function toChunk(item: KnowledgeBaseRetrievalResult): RetrievedChunk {
  const metadata = (item.metadata ?? {}) as Record<string, unknown>;
  const uri =
    item.location?.s3Location?.uri
    ?? item.location?.webLocation?.url
    ?? (metadata[SOURCE_URI_METADATA_KEY] as string | undefined)
    ?? '';
  const pageRaw = metadata[PAGE_NUMBER_METADATA_KEY];
  const page = typeof pageRaw === 'number'
    ? pageRaw
    : typeof pageRaw === 'string' && /^\d+$/.test(pageRaw)
      ? Number.parseInt(pageRaw, 10)
      : null;

  return {
    text: item.content?.text ?? '',
    score: item.score ?? 0,
    uri,
    page,
    metadata,
  };
}
