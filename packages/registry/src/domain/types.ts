// `builtin__<name>` | `mcp__<server>`; base tools are auto-attached.
export type ToolRef = string;

export type McpAuth =
  | { kind: 'bearer'; token: VarTemplated }
  | { kind: 'header'; name: string; value: VarTemplated };

export interface McpServerConfig {
  url: string;
  auth?: McpAuth;
}

// Process env would break per-tenant isolation, so template-referenced
// values live here, not in the environment.
export type Var =
  | { type: 'plain'; value: string }
  | { type: 'secretmanager'; secretId: string; region?: string; jsonField?: string };

// Literal, or one or more `{{ vars.NAME }}` blocks (mid-string OK).
export type VarTemplated = string;

export interface BedrockCredentials {
  accessKeyId: VarTemplated;
  secretAccessKey: VarTemplated;
  sessionToken?: VarTemplated;
}

export interface BedrockModelDef {
  id: string;
  region?: string;
  credentials?: BedrockCredentials;
  maxTokens?: number;
  temperature?: number;
}

export interface OpenAIModelDef {
  id: string;
  apiKey: VarTemplated;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AnthropicModelDef {
  id: string;
  apiKey: VarTemplated;
  maxTokens?: number;
  temperature?: number;
}

export type ModelDef =
  | { provider: 'bedrock'; bedrock: BedrockModelDef }
  | { provider: 'openai'; openai: OpenAIModelDef }
  | { provider: 'anthropic'; anthropic: AnthropicModelDef };

export interface AgentDefinition {
  tenantId: string;
  tenantSlug: string;
  agentId: string;
  agentSlug: string;
  version: string;
  enabled: boolean;
  description: string;
  systemPrompt: string;
  model: ModelDef;
  tools: ToolRef[];
}

export interface AgentIdentity {
  tenantId: string;
  tenantSlug: string;
  agentId: string;
  agentSlug: string;
  version: string;
  enabled: boolean;
  description: string;
}

export interface TenantIdentity {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
}
