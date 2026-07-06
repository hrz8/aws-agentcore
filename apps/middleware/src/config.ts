import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

export const AgentMode = {
  Plain: 'plain',
  AgentCore: 'agentcore',
} as const;
export type AgentMode = typeof AgentMode[keyof typeof AgentMode];

export const RegistrySource = {
  S3Yaml: 's3-yaml',
  DbPostgres: 'db-postgres',
} as const;
export type RegistrySource = typeof RegistrySource[keyof typeof RegistrySource];

const envSchema = z.object({
  PORT: z.union([z.string(), z.number()])
    .transform((v) => Number.parseInt(String(v), 10))
    .refine(Number.isFinite, 'invalid PORT')
    .default(8080),
  AWS_REGION: z.string().min(1).default('us-east-1'),
  CORS_ORIGIN: z.string()
    .default('http://localhost:3456,http://localhost:5200')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),

  AGENT_MODE: z.enum(AgentMode).default(AgentMode.Plain),
  AGENT_PLAIN_URL: z.url().default('http://localhost:5678'),
  AGENT_RUNTIME_ARN: z.string().min(1).optional(),
  AGENT_RUNTIME_QUALIFIER: z.string().min(1).optional(),

  COPILOTKIT_UPSTREAM_URL: z.url().optional(),

  REGISTRY_SOURCE: z.enum(RegistrySource).default(RegistrySource.S3Yaml),
  REGISTRY_S3_KEY: z.string().min(1).default('registry.yaml'),
  REGISTRY_DB_URL: z.string().optional(),
  UPLOADS_BUCKET: z.string().optional(),
}).transform((env) => ({
  ...env,
  COPILOTKIT_UPSTREAM_URL: env.COPILOTKIT_UPSTREAM_URL ?? `http://localhost:${env.PORT}/chat`,
}));

export const {
  PORT,
  AWS_REGION,
  CORS_ORIGIN,
  AGENT_MODE,
  AGENT_PLAIN_URL,
  AGENT_RUNTIME_ARN,
  AGENT_RUNTIME_QUALIFIER,
  COPILOTKIT_UPSTREAM_URL,
  REGISTRY_SOURCE,
  REGISTRY_S3_KEY,
  REGISTRY_DB_URL,
  UPLOADS_BUCKET,
} = Object.freeze(envSchema.parse(process.env));
