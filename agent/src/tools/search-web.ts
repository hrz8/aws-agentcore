import { tool } from '@strands-agents/sdk';
import { z } from 'zod';

import { retrieve, DATA_SOURCE_ID_METADATA_KEY } from '../utils/aws/bedrock/retrieve.js';

const SearchWebInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      'A focused, natural-language query about something that might appear on the public websites we have crawled.',
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
  readonly webDataSourceId: string;
};

export function createSearchWebTool(opts: CreateSearchWebToolOptions) {
  return tool({
    name: 'search_web',
    description:
      'Search content crawled from the configured public websites for passages relevant to a query. ' +
      'Returns the top matching passages with their source URL and relevance score. ' +
      'Use this when the user asks about something documented on the websites we have indexed. ' +
      'Cite the source URL in your answer.',
    inputSchema: SearchWebInputSchema,
    callback: async (input): Promise<SearchWebResult> => {
      const maxResults = input.maxResults ?? 5;
      const chunks = await retrieve({
        kbId: opts.kbId,
        query: input.query,
        maxResults,
        filter: {
          equals: { key: DATA_SOURCE_ID_METADATA_KEY, value: opts.webDataSourceId },
        },
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

function hostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}
