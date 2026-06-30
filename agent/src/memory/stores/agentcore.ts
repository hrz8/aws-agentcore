import type { MemoryStore } from '@strands-agents/sdk';

import { createAgentCoreMemoryStores } from 'bedrock-agentcore/experimental/memory/strands';

import { AGENTCORE_MEMORY_CONFIG, AWS_REGION } from '../../config.js';

export type CreateAgentCoreStoresInput = {
  readonly actorId: string;
  readonly sessionId: string;
};

export function createAgentCoreStores(input: CreateAgentCoreStoresInput): MemoryStore[] | null {
  if (!AGENTCORE_MEMORY_CONFIG) return null;
  return createAgentCoreMemoryStores({
    memoryId: AGENTCORE_MEMORY_CONFIG.memoryId,
    actorId: input.actorId,
    sessionId: input.sessionId,
    region: AWS_REGION,
    extraction: true,
    namespaces: [
      { namespace: AGENTCORE_MEMORY_CONFIG.namespaceFacts, writable: true },
      { namespace: AGENTCORE_MEMORY_CONFIG.namespacePreferences },
      { namespace: AGENTCORE_MEMORY_CONFIG.namespaceSummary },
    ],
  });
}
