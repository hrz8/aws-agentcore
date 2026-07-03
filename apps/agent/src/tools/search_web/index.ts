import { tool } from '@strands-agents/sdk';
import { retrieve, type RetrievalFilter } from '@repo/kit/aws/bedrock-runtime';
import { METADATA_KEYS } from '@repo/kit/paths';
import { z } from 'zod';

import { bedrockRuntime } from '../../utils/aws.js';

const SearchWebInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      'A focused, natural-language query about something that might appear on the websites we have crawled for this agent.',
    ),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .describe('Max number of passages to return (1-20). Defaults to 5.'),
});

const SearchWebResultSchema = z.object({
  results: z.array(z.object({
    text: z.string(),
    score: z.number(),
    source: z.object({
      url: z.string(),
      host: z.string(),
    }),
  })),
});

export type SearchWebResult = z.infer<typeof SearchWebResultSchema>;

export type CreateSearchWebToolOptions = {
  readonly kbId: string;
  readonly tenantId: string;
  readonly agentIds: readonly string[];
  readonly version: string;
};

export function createSearchWebTool(opts: CreateSearchWebToolOptions) {
  const filter = buildWebScopeFilter(opts.tenantId, opts.agentIds, opts.version);

  return tool({
    name: 'search_web',
    description:
      'Search content crawled from the websites configured for this agent for passages relevant to a query. '
      + 'Returns the top matching passages with their source URL and relevance score. '
      + 'Use this when the user asks about something documented on the websites we have indexed. '
      + 'Cite the source URL in your answer.',
    inputSchema: SearchWebInputSchema,
    callback: async (input): Promise<SearchWebResult> => {
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
          source: { url: c.uri, host: hostFromUrl(c.uri) },
        })),
      };
    },
  });
}

function buildWebScopeFilter(
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

function hostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}
