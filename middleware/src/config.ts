import { z } from 'zod';

// ============================================================================
// Runtime
// ============================================================================

export const PORT = Number.parseInt(process.env.PORT ?? '8080', 10);
export const AWS_REGION = process.env.AWS_REGION ?? 'us-east-1';

export const CORS_ORIGIN = (process.env.CORS_ORIGIN ?? 'http://localhost:3456')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// ============================================================================
// Agent backend
// ============================================================================

export type AgentMode = 'plain' | 'agentcore';

function parseAgentMode(value: string | undefined): AgentMode {
  if (value === 'plain' || value === 'agentcore') return value;
  return 'plain';
}

export const AGENT_MODE: AgentMode = parseAgentMode(process.env.AGENT_MODE);
export const AGENT_PLAIN_URL = process.env.AGENT_PLAIN_URL ?? 'http://localhost:5678';

// AGENT_MODE=agentcore — SigV4-signed call to a deployed AgentCore Runtime.
export const AGENT_RUNTIME_ARN = process.env.AGENT_RUNTIME_ARN;
export const AGENT_RUNTIME_QUALIFIER = process.env.AGENT_RUNTIME_QUALIFIER;

// CopilotKit route — loops back through our own /chat.
export const COPILOTKIT_UPSTREAM_URL =
  process.env.COPILOTKIT_UPSTREAM_URL ?? `http://localhost:${PORT}/chat`;

// ============================================================================
// Genesis tenant + agent (bootstrap, pre-catalog).
// Replaced by x-tenant-id / x-agent-id headers once the agent-abstraction
// YAML catalog lands.
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
// Agent scope — identity + shared bucket. Used by both /kb/* and /skills/*.
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

// Alias export so /skills/* routes don't import a name that suggests KB.
export type SkillsConfig = AgentScopeConfig;
export const SKILLS_CONFIG: SkillsConfig | null = AGENT_SCOPE;

// ============================================================================
// Knowledge base — KB-specific settings layered on AGENT_SCOPE
// ============================================================================

export const KB_ID = process.env.KB_ID;
export const KB_S3_DATA_SOURCE_ID = process.env.KB_S3_DATA_SOURCE_ID;
export const KB_WEB_DATA_SOURCE_ID = process.env.KB_WEB_DATA_SOURCE_ID;

const kbConfigSchema = z.object({
  tenantId: z.string().min(1),
  agentId: z.string().min(1),
  uploadsBucket: z.string().min(1),
  kbId: z.string().min(1),
  s3DataSourceId: z.string().min(1),
  webDataSourceId: z.string().min(1).optional(),
});

export type KbConfig = z.infer<typeof kbConfigSchema>;

function loadKbConfig(): KbConfig | null {
  if (!AGENT_SCOPE) {
    if (KB_ID || KB_S3_DATA_SOURCE_ID) {
      throw new Error('KB_ID/KB_S3_DATA_SOURCE_ID set but agent scope (GENESIS_*/UPLOADS_BUCKET) is missing');
    }
    return null;
  }
  if (!KB_ID && !KB_S3_DATA_SOURCE_ID) return null;
  if (!KB_ID || !KB_S3_DATA_SOURCE_ID) {
    throw new Error('KB config partial: set both KB_ID and KB_S3_DATA_SOURCE_ID, or neither');
  }
  return kbConfigSchema.parse({
    ...AGENT_SCOPE,
    kbId: KB_ID,
    s3DataSourceId: KB_S3_DATA_SOURCE_ID,
    webDataSourceId: KB_WEB_DATA_SOURCE_ID || undefined,
  });
}

export const KB_CONFIG: KbConfig | null = loadKbConfig();
