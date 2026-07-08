import type { MemoryStore } from '@strands-agents/sdk';

import { createAgentCoreMemoryStores } from 'bedrock-agentcore/experimental/memory/strands';

import {
  AWS_REGION,
  MEMORY_AGENTCORE_ID,
  MEMORY_AGENTCORE_NS_FACTS,
  MEMORY_AGENTCORE_NS_PREFERENCES,
  MEMORY_AGENTCORE_NS_SUMMARY,
} from '../../config.js';

export type CreateAgentCoreStoresInput = {
  readonly actorId: string;
  readonly sessionId: string;
};

export function createAgentCoreStores(input: CreateAgentCoreStoresInput): MemoryStore[] | null {
  if (!MEMORY_AGENTCORE_ID) {
    return null;
  }
  return createAgentCoreMemoryStores({
    memoryId: MEMORY_AGENTCORE_ID,
    actorId: input.actorId,
    sessionId: input.sessionId,
    region: AWS_REGION,
    extraction: true,
    namespaces: [
      { namespace: MEMORY_AGENTCORE_NS_FACTS!, writable: true },
      { namespace: MEMORY_AGENTCORE_NS_PREFERENCES! },
      { namespace: MEMORY_AGENTCORE_NS_SUMMARY! },
    ],
  });
}
