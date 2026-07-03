import { tool } from '@strands-agents/sdk';
import { retrieve, type RetrievalFilter } from '@repo/kit/aws/bedrock-runtime';
import { METADATA_KEYS } from '@repo/kit/paths';
import { z } from 'zod';

import { bedrockRuntime } from '../../utils/aws.js';

const SearchDocumentsInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      'A focused, natural-language query about something that might appear in the user\'s uploaded documents. '
      + 'Prefer specific phrases over single keywords (e.g. "termination clause for fixed-term contracts" beats "termination").',
    ),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .describe('Max number of passages to return (1-20). Defaults to 5.'),
});

const SearchDocumentsResultSchema = z.object({
  results: z.array(z.object({
    text: z.string(),
    score: z.number(),
    source: z.object({
      uri: z.string(),
      basename: z.string(),
      page: z.number().nullable(),
    }),
  })),
  scopedTo: z.array(z.string()),
});

export type SearchDocumentsResult = z.infer<typeof SearchDocumentsResultSchema>;

export type CreateSearchDocumentsToolOptions = {
  readonly kbId: string;
  readonly tenantId: string;
  readonly agentIds: readonly string[];
  readonly version: string;
};

export function createSearchDocumentsTool(opts: CreateSearchDocumentsToolOptions) {
  const filter = buildKbScopeFilter(opts.tenantId, opts.agentIds, opts.version);

  return tool({
    name: 'search_documents',
    description:
      "Search the user's uploaded documents for passages relevant to a query. "
      + 'Returns the top matching passages with their source file URI, page (when available), and relevance score. '
      + 'Use this whenever the user asks about something that might be in their files (contracts, notes, manuals, policies, reports, …). '
      + 'Cite the source file in your answer.',
    inputSchema: SearchDocumentsInputSchema,
    callback: async (input): Promise<SearchDocumentsResult> => {
      const maxResults = input.maxResults ?? 5;
      const chunks = await retrieve(bedrockRuntime, {
        kbId: opts.kbId,
        query: input.query,
        maxResults,
        filter,
      });
      return {
        results: chunks.map(c => ({
          text: c.text,
          score: c.score,
          source: {
            uri: c.uri,
            basename: basenameFromUri(c.uri),
            page: c.page,
          },
        })),
        scopedTo: [...opts.agentIds],
      };
    },
  });
}

function buildKbScopeFilter(
  tenantId: string,
  agentIds: readonly string[],
  version: string,
): RetrievalFilter {
  const agentClause: RetrievalFilter =
    agentIds.length === 1
      ? { equals: { key: METADATA_KEYS.agentId, value: agentIds[0] } }
      : { in: { key: METADATA_KEYS.agentId, value: [...agentIds] } };

  return {
    andAll: [
      { equals: { key: METADATA_KEYS.tenantId, value: tenantId } },
      agentClause,
      { equals: { key: METADATA_KEYS.agentVersion, value: version } },
    ],
  };
}

function basenameFromUri(uri: string): string {
  if (!uri) return '';
  const slash = uri.lastIndexOf('/');
  return slash >= 0 ? uri.slice(slash + 1) : uri;
}
