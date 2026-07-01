import { z } from 'zod';

// ============================================================================
// Runtime
// ============================================================================

export const PORT = Number.parseInt(process.env.PORT ?? '8080', 10);
export const AWS_REGION = process.env.AWS_REGION ?? 'us-east-1';

// ============================================================================
// Memory
// ============================================================================

export type MemoryProvider = 'agentcore' | 'none';

function parseMemoryProvider(value: string | undefined): MemoryProvider {
  if (value === 'agentcore' || value === 'none') return value;
  return 'agentcore';
}

export const MEMORY_PROVIDER: MemoryProvider = parseMemoryProvider(process.env.MEMORY_PROVIDER);

export type MemoryStorage = 'noop';

function parseMemoryStorage(value: string | undefined): MemoryStorage {
  if (value === 'noop') return value;
  return 'noop';
}

export const MEMORY_STORAGE: MemoryStorage = parseMemoryStorage(process.env.MEMORY_STORAGE);

// ---- AgentCore-specific ----
export const MEMORY_ID = process.env.MEMORY_ID;
export const MEMORY_NS_FACTS = process.env.MEMORY_NS_FACTS;
export const MEMORY_NS_PREFERENCES = process.env.MEMORY_NS_PREFERENCES;
export const MEMORY_NS_SUMMARY = process.env.MEMORY_NS_SUMMARY;

const agentCoreMemoryConfigSchema = z.object({
  memoryId: z.string().min(1),
  namespaceFacts: z.string().min(1),
  namespacePreferences: z.string().min(1),
  namespaceSummary: z.string().min(1),
});

export type AgentCoreMemoryConfig = z.infer<typeof agentCoreMemoryConfigSchema>;

const AGENTCORE_MEMORY_CORE = {
  MEMORY_ID,
  MEMORY_NS_FACTS,
  MEMORY_NS_PREFERENCES,
  MEMORY_NS_SUMMARY,
} as const;

function loadAgentCoreMemoryConfig(): AgentCoreMemoryConfig | null {
  const keys = Object.keys(AGENTCORE_MEMORY_CORE) as (keyof typeof AGENTCORE_MEMORY_CORE)[];
  const presentCount = keys.filter(k => AGENTCORE_MEMORY_CORE[k]).length;
  if (presentCount === 0) return null;
  if (presentCount < keys.length) {
    const missing = keys.filter(k => !AGENTCORE_MEMORY_CORE[k]).join(', ');
    throw new Error(
      `AgentCore memory config is partial; expected all-or-none. Missing: ${missing}. ` +
      `Set all of ${keys.join(', ')}, or none.`,
    );
  }
  return agentCoreMemoryConfigSchema.parse({
    memoryId: MEMORY_ID,
    namespaceFacts: MEMORY_NS_FACTS,
    namespacePreferences: MEMORY_NS_PREFERENCES,
    namespaceSummary: MEMORY_NS_SUMMARY,
  });
}

export const AGENTCORE_MEMORY_CONFIG: AgentCoreMemoryConfig | null = loadAgentCoreMemoryConfig();

// ============================================================================
// Model provider (agent-scoped — agent factory may select per agent)
// ============================================================================

export type ModelProvider = 'bedrock' | 'openai' | 'anthropic';

function parseModelProvider(value: string | undefined): ModelProvider {
  if (value === 'bedrock' || value === 'openai' || value === 'anthropic') return value;
  return 'bedrock';
}

export const MODEL_PROVIDER: ModelProvider = parseModelProvider(process.env.MODEL_PROVIDER);

// ---- Bedrock ----
export const BEDROCK_MODEL_ID =
  process.env.BEDROCK_MODEL_ID ?? 'global.anthropic.claude-sonnet-4-6';

// ---- OpenAI / OpenAI-compatible gateway (OpenRouter, Bifrost, LiteLLM, ...) ----
export const OPENAI_MODEL_ID = process.env.OPENAI_MODEL_ID ?? 'gpt-5';
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;

// ---- Anthropic direct API ----
export const ANTHROPIC_MODEL_ID =
  process.env.ANTHROPIC_MODEL_ID ?? 'claude-sonnet-4-6';
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// ============================================================================
// Genesis tenant + agent (bootstrap, pre-catalog).
// Replaced by per-request (tenantId, agentId) from `forwardedProps` once the
// agent-abstraction YAML catalog lands.
// ============================================================================

export const GENESIS_TENANT_ID = process.env.GENESIS_TENANT_ID;
export const GENESIS_AGENT_ID = process.env.GENESIS_AGENT_ID;

export function composeAgentScope(tenantId: string, agentId: string): string {
  return `${tenantId}__${agentId}`;
}

// ============================================================================
// Shared uploads bucket (KB docs + skills + future top-level dirs)
// ============================================================================

export const UPLOADS_BUCKET = process.env.UPLOADS_BUCKET;

// ============================================================================
// Agent scope — identity + shared bucket. Used by both skills and KB tools.
// ============================================================================

const agentScopeConfigSchema = z.object({
  tenantId: z.string().min(1),
  agentId: z.string().min(1),
  uploadsBucket: z.string().min(1),
});

export type AgentScopeConfig = z.infer<typeof agentScopeConfigSchema>;

const SCOPE_CORE = {
  GENESIS_TENANT_ID,
  GENESIS_AGENT_ID,
  UPLOADS_BUCKET,
} as const;

function loadAgentScopeConfig(): AgentScopeConfig | null {
  const keys = Object.keys(SCOPE_CORE) as (keyof typeof SCOPE_CORE)[];
  const presentCount = keys.filter(k => SCOPE_CORE[k]).length;
  if (presentCount === 0) return null;
  if (presentCount < keys.length) {
    const missing = keys.filter(k => !SCOPE_CORE[k]).join(', ');
    throw new Error(
      `Agent scope config is partial; expected all-or-none. Missing: ${missing}. ` +
      `Set all of ${keys.join(', ')}, or none.`,
    );
  }
  return agentScopeConfigSchema.parse({
    tenantId: GENESIS_TENANT_ID,
    agentId: GENESIS_AGENT_ID,
    uploadsBucket: UPLOADS_BUCKET,
  });
}

export const AGENT_SCOPE: AgentScopeConfig | null = loadAgentScopeConfig();

// ============================================================================
// Knowledge base — KB-specific settings, layered on AGENT_SCOPE
// ============================================================================

export const KB_ID = process.env.KB_ID;
export const KB_WEB_DATA_SOURCE_ID = process.env.KB_WEB_DATA_SOURCE_ID;

const kbConfigSchema = z.object({
  tenantId: z.string().min(1),
  agentId: z.string().min(1),
  uploadsBucket: z.string().min(1),
  kbId: z.string().min(1),
  webDataSourceId: z.string().min(1).optional(),
});

export type KbConfig = z.infer<typeof kbConfigSchema>;

function loadKbConfig(): KbConfig | null {
  if (!AGENT_SCOPE) {
    if (KB_ID) {
      throw new Error('KB_ID is set but GENESIS_TENANT_ID/GENESIS_AGENT_ID/UPLOADS_BUCKET are missing');
    }
    return null;
  }
  if (!KB_ID) return null;
  return kbConfigSchema.parse({
    ...AGENT_SCOPE,
    kbId: KB_ID,
    webDataSourceId: KB_WEB_DATA_SOURCE_ID || undefined,
  });
}

export const KB_CONFIG: KbConfig | null = loadKbConfig();
