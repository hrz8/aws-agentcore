export type AgentIdentity = {
  tenantId: string;
  tenantSlug: string;
  agentId: string;
  agentSlug: string;
  version: string;
  enabled: boolean;
  description: string;
};

export type RegistryYaml = { text: string; etag: string | null };
