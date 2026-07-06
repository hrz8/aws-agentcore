// `builtin__<name>` | `mcp__<server>`; base tools are auto-attached.
export type ToolRef = string;

export interface BuiltinToolConfig {
  description: string;
}

export const McpAuthKind = {
  Bearer: 'bearer',
  Header: 'header',
} as const;
export type McpAuthKind = typeof McpAuthKind[keyof typeof McpAuthKind];

export type McpAuth =
  | { kind: typeof McpAuthKind.Bearer; token: VarTemplated }
  | { kind: typeof McpAuthKind.Header; name: string; value: VarTemplated };

export interface McpServerConfig {
  url: string;
  auth?: McpAuth;
}

export const VarKind = {
  Plain: 'plain',
  SecretManager: 'secretmanager',
} as const;
export type VarKind = typeof VarKind[keyof typeof VarKind];

// Process env would break per-tenant isolation, so template-referenced
// values live here, not in the environment.
export type Var =
  | { type: typeof VarKind.Plain; value: string }
  | { type: typeof VarKind.SecretManager; secretId: string; region?: string; jsonField?: string };

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

export const ModelProvider = {
  Bedrock: 'bedrock',
  OpenAI: 'openai',
  Anthropic: 'anthropic',
} as const;
export type ModelProvider = typeof ModelProvider[keyof typeof ModelProvider];

export type ModelDef =
  | { provider: typeof ModelProvider.Bedrock; bedrock: BedrockModelDef }
  | { provider: typeof ModelProvider.OpenAI; openai: OpenAIModelDef }
  | { provider: typeof ModelProvider.Anthropic; anthropic: AnthropicModelDef };

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
