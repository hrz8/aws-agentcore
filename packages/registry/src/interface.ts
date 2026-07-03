import type {
  AgentDefinition,
  AgentIdentity,
  McpServerConfig,
  TenantIdentity,
  Var,
} from './domain/index.js';

import type { BranchInput, BranchResult } from './types.js';

export interface TenantRepository {
  list(): Promise<TenantIdentity[]>;
}

export interface AgentRepository {
  listByTenantId(tenantId: string): Promise<AgentDefinition[]>;
  listByTenantSlug(tenantSlug: string): Promise<AgentDefinition[]>;
  getByIds(tenantId: string, agentId: string, version: string): Promise<AgentDefinition | null>;
  getBySlugs(tenantSlug: string, agentSlug: string, version: string): Promise<AgentDefinition | null>;
  resolveEnabledByIds(tenantId: string, agentId: string): Promise<AgentDefinition>;
  identities(tenantId: string): Promise<AgentIdentity[]>;
  branch(input: BranchInput): Promise<BranchResult>;
}

export interface McpServerRepository {
  listByTenantId(tenantId: string): Promise<Record<string, McpServerConfig>>;
}

export interface VarRepository {
  listByTenantId(tenantId: string): Promise<Record<string, Var>>;
}

export interface RawTextEditable {
  read(): Promise<{ text: string; etag: string | undefined }>;
  write(text: string): Promise<{ etag: string | undefined }>;
}

export interface RegistryRepository {
  readonly tenants: TenantRepository;
  readonly agents: AgentRepository;
  readonly mcpServers: McpServerRepository;
  readonly vars: VarRepository;
  readonly rawText: RawTextEditable | null;
  refresh(): Promise<void>;
}
