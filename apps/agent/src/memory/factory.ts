import type { MemoryStore } from '@strands-agents/sdk';

import { MemoryManager } from '@strands-agents/sdk';

import { MEMORY_PROVIDER, MemoryProvider } from '../config.js';
import { createAgentCoreStores } from './stores/agentcore.js';

export type CreateMemoryManagerInput = {
  readonly actorId: string;
  readonly sessionId: string;
};

export function createMemoryManager(input: CreateMemoryManagerInput): MemoryManager | null {
  let stores: MemoryStore[] | null;
  switch (MEMORY_PROVIDER) {
    case MemoryProvider.AgentCore:
      stores = createAgentCoreStores(input);
      break;
    case MemoryProvider.None:
      stores = null;
      break;
  }
  if (!stores || stores.length === 0) return null;
  return new MemoryManager({ stores });
}
