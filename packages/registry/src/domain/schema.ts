import { z } from 'zod';

export const TOOL_REF_REGEX = /^(?:builtin__[a-z0-9_]+|mcp__[a-z0-9_-]+)$/;
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const SLUG_REGEX = /^[a-z][a-z0-9-]{0,62}[a-z0-9]$/;
export const VERSION_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,31}$/;

export const UuidSchema = z.string().regex(UUID_REGEX, 'must be a UUID');
export const SlugSchema = z.string().regex(SLUG_REGEX, 'must be lowercase kebab-case, 2-64 chars');
export const VersionSchema = z.string().regex(VERSION_REGEX, 'must be [a-zA-Z0-9._-], 1-32 chars');

export const VarTemplatedSchema = z.string().min(1);

export const McpAuthSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('bearer'),
    token: VarTemplatedSchema,
  }),
  z.object({
    kind: z.literal('header'),
    name: z.string().min(1),
    value: VarTemplatedSchema,
  }),
]);

export const McpServerSchema = z.object({
  url: z.url(),
  auth: McpAuthSchema.optional(),
});

export const ToolRefSchema = z.string().regex(
  TOOL_REF_REGEX,
  'tool ref must match builtin__<name> or mcp__<server>',
);

export const VarSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('plain'), value: z.string() }),
  z.object({
    type: z.literal('secretmanager'),
    secretId: z.string().min(1),
    region: z.string().min(1).optional(),
    jsonField: z.string().min(1).optional(),
  }),
]);

export const BedrockCredentialsSchema = z.object({
  accessKeyId: VarTemplatedSchema,
  secretAccessKey: VarTemplatedSchema,
  sessionToken: VarTemplatedSchema.optional(),
});

export const BedrockModelSchema = z.object({
  id: z.string().min(1),
  region: z.string().min(1).optional(),
  credentials: BedrockCredentialsSchema.optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

export const OpenAIModelSchema = z.object({
  id: z.string().min(1),
  apiKey: VarTemplatedSchema,
  baseUrl: z.url().optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

export const AnthropicModelSchema = z.object({
  id: z.string().min(1),
  apiKey: VarTemplatedSchema,
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

export const ModelSchema = z.discriminatedUnion('provider', [
  z.object({ provider: z.literal('bedrock'), bedrock: BedrockModelSchema }),
  z.object({ provider: z.literal('openai'), openai: OpenAIModelSchema }),
  z.object({ provider: z.literal('anthropic'), anthropic: AnthropicModelSchema }),
]);

export const AgentRowSchema = z.object({
  id: UuidSchema,
  slug: SlugSchema,
  version: VersionSchema,
  enabled: z.boolean(),
  description: z.string().min(1),
  systemPrompt: z.string().min(1),
  model: ModelSchema,
  tools: z.array(ToolRefSchema),
});

export type AgentRow = z.infer<typeof AgentRowSchema>;
