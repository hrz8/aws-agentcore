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
// Knowledge base
// ============================================================================

// ---- Global ----
export const KB_ID = process.env.KB_ID;
export const KB_DOCS_BUCKET = process.env.KB_DOCS_BUCKET;
export const KB_S3_DATA_SOURCE_ID = process.env.KB_S3_DATA_SOURCE_ID;
export const KB_WEB_DATA_SOURCE_ID = process.env.KB_WEB_DATA_SOURCE_ID;

// ---- Agent-scoped ----
export const AGENT_ID = process.env.AGENT_ID;

// ---- Validated ----

const kbConfigSchema = z.object({
  agentId: z.string().min(1),
  kbId: z.string().min(1),
  docsBucket: z.string().min(1),
  s3DataSourceId: z.string().min(1),
  webDataSourceId: z.string().min(1).optional(),
});

export type KbConfig = z.infer<typeof kbConfigSchema>;

const KB_CORE = { AGENT_ID, KB_ID, KB_DOCS_BUCKET, KB_S3_DATA_SOURCE_ID } as const;

function loadKbConfig(): KbConfig | null {
  const keys = Object.keys(KB_CORE) as (keyof typeof KB_CORE)[];
  const presentCount = keys.filter(k => KB_CORE[k]).length;
  if (presentCount === 0) return null;
  if (presentCount < keys.length) {
    const missing = keys.filter(k => !KB_CORE[k]).join(', ');
    throw new Error(
      `KB config is partial; expected all-or-none. Missing: ${missing}. ` +
      `Set all of ${keys.join(', ')}, or none.`,
    );
  }
  return kbConfigSchema.parse({
    agentId: AGENT_ID,
    kbId: KB_ID,
    docsBucket: KB_DOCS_BUCKET,
    s3DataSourceId: KB_S3_DATA_SOURCE_ID,
    webDataSourceId: KB_WEB_DATA_SOURCE_ID || undefined,
  });
}

export const KB_CONFIG: KbConfig | null = loadKbConfig();
