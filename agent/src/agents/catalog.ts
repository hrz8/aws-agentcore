// `builtin__<name>` | `mcp__<server>`. Granular `mcp__<server>__<tool>` is
// rejected — Strands TS can't filter tools out of an MCP server.
export type ToolRef = string;

export type McpAuth =
  | { kind: 'bearer'; token: VarTemplated }
  | { kind: 'header'; name: string; value: VarTemplated };

export interface McpServerConfig {
  url: string;
  auth?: McpAuth;
}

// `env` is intentionally not a type: env vars are runtime-scoped and would
// break per-tenant isolation. Runtime-shared values stay in config.ts.
export type Var =
  | { type: 'plain'; value: string }
  | { type: 'secretmanager'; secretId: string; region?: string; jsonField?: string };

// Literal, or one or more `{{ vars.NAME }}` blocks. Mid-string interpolation is
// supported.
export type VarTemplated = string;

// Omit on Bedrock to use the AWS SDK provider chain (the in-AWS case).
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
  | { provider: 'bedrock';   bedrock:   BedrockModelDef   }
  | { provider: 'openai';    openai:    OpenAIModelDef    }
  | { provider: 'anthropic'; anthropic: AnthropicModelDef };

export interface AgentDefinition {
  tenantId: string;
  id: string;
  description: string;
  systemPrompt: string;
  model: ModelDef;
  tools: ToolRef[];
}

export interface AgentCatalog {
  list(tenantId: string): Promise<AgentDefinition[]>;
  get(tenantId: string, agentId: string): Promise<AgentDefinition | null>;
  mcpServers(tenantId: string): Promise<Record<string, McpServerConfig>>;
  vars(tenantId: string): Promise<Record<string, Var>>;
}
