import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

export const RegistrySource = {
  S3Yaml: 's3-yaml',
  LocalYaml: 'local-yaml',
  DbPostgres: 'db-postgres',
} as const;
export type RegistrySource = typeof RegistrySource[keyof typeof RegistrySource];

export const MemoryProvider = {
  AgentCore: 'agentcore',
  SQLite: 'sqlite',
  None: 'none',
} as const;
export type MemoryProvider = typeof MemoryProvider[keyof typeof MemoryProvider];

export const MemoryStorage = {
  Noop: 'noop',
} as const;
export type MemoryStorage = typeof MemoryStorage[keyof typeof MemoryStorage];

const envSchema = z.object({
  PORT: z.union([z.string(), z.number()])
    .transform((v) => Number.parseInt(String(v), 10))
    .refine(Number.isFinite, 'invalid PORT')
    .default(8080),
  AWS_REGION: z.string().min(1).default('us-east-1'),
  REGISTRY_SOURCE: z.enum(RegistrySource).default(RegistrySource.S3Yaml),
  REGISTRY_S3_KEY: z.string().min(1).default('registry/agents.yaml'),
  REGISTRY_DB_URL: z.string().min(1).optional(),
  REGISTRY_LOCAL_YAML_PATH: z.string().min(1).optional(),
  UPLOADS_BUCKET: z.string().min(1).optional(),
  KB_ID: z.string().min(1).optional(),
  KB_WEB_DATA_SOURCE_ID: z.string().min(1).optional(),
  MEMORY_PROVIDER: z.enum(MemoryProvider).default(MemoryProvider.AgentCore),
  MEMORY_STORAGE: z.enum(MemoryStorage).default(MemoryStorage.Noop),
  MEMORY_AGENTCORE_ID: z.string().min(1).optional(),
  MEMORY_AGENTCORE_NS_FACTS: z.string().min(1).optional(),
  MEMORY_AGENTCORE_NS_PREFERENCES: z.string().min(1).optional(),
  MEMORY_AGENTCORE_NS_SUMMARY: z.string().min(1).optional(),
  MEMORY_SQLITE_DB_PATH: z.string().min(1).default('.data/memory.db'),
  MEMORY_SQLITE_STORE_NAME: z.string().min(1).default('notes'),
  MEMORY_SQLITE_STORE_DESCRIPTION: z.string().min(1).default(
    'Long-term notes and facts extracted from prior conversations with this user.',
  ),
  MEMORY_SQLITE_MAX_SEARCH_RESULTS: z.union([z.string(), z.number()])
    .transform((v) => Number.parseInt(String(v), 10))
    .refine((v) => Number.isFinite(v) && v > 0, 'invalid MEMORY_SQLITE_MAX_SEARCH_RESULTS')
    .default(5),
}).superRefine((env, ctx) => {
  if (env.MEMORY_PROVIDER !== MemoryProvider.AgentCore) return;
  const keys = [
    'MEMORY_AGENTCORE_ID',
    'MEMORY_AGENTCORE_NS_FACTS',
    'MEMORY_AGENTCORE_NS_PREFERENCES',
    'MEMORY_AGENTCORE_NS_SUMMARY',
  ] as const;
  const missing = keys.filter((k) => env[k] === undefined);
  if (missing.length > 0 && missing.length < keys.length) {
    ctx.addIssue({
      code: 'custom',
      message: `AgentCore memory config is all-or-none. Missing: ${missing.join(', ')}.`,
    });
  }
});

export const {
  PORT,
  AWS_REGION,
  REGISTRY_SOURCE,
  REGISTRY_S3_KEY,
  REGISTRY_DB_URL,
  REGISTRY_LOCAL_YAML_PATH,
  UPLOADS_BUCKET,
  KB_ID,
  KB_WEB_DATA_SOURCE_ID,
  MEMORY_PROVIDER,
  MEMORY_STORAGE,
  MEMORY_AGENTCORE_ID,
  MEMORY_AGENTCORE_NS_FACTS,
  MEMORY_AGENTCORE_NS_PREFERENCES,
  MEMORY_AGENTCORE_NS_SUMMARY,
  MEMORY_SQLITE_DB_PATH,
  MEMORY_SQLITE_STORE_NAME,
  MEMORY_SQLITE_STORE_DESCRIPTION,
  MEMORY_SQLITE_MAX_SEARCH_RESULTS,
} = Object.freeze(envSchema.parse(process.env));

