import type { AgentDefinition } from './domain/index.js';

export type BranchInput = {
  tenantId: string;
  agentId: string;
  fromVersion: string;
  toVersion: string;
  enabled: boolean;
};

export type BranchResult = {
  target: AgentDefinition;
  etag: string | undefined;
};
