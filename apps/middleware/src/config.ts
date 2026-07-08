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
  LocalYaml: 'local-yaml',
  DbPostgres: 'db-postgres',
} as const;
export type RegistrySource = typeof RegistrySource[keyof typeof RegistrySource];

export const RunnerType = {
  InMemory: 'in-memory',
  Sqlite: 'sqlite',
  DynamoDB: 'dynamodb',
  S3: 's3',
} as const;
export type RunnerType = typeof RunnerType[keyof typeof RunnerType];

const envSchema = z.object({
  PORT: z.union([z.string(), z.number()])
    .transform((v) => Number.parseInt(String(v), 10))
    .refine(Number.isFinite, 'invalid PORT')
    .default(8080),
  AWS_REGION: z.string().min(1).default('us-east-1'),
  CORS_ORIGIN: z.string()
    .default('http://localhost:3456,http://localhost:8765')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),

  AGENT_MODE: z.enum(AgentMode).default(AgentMode.Plain),
  AGENT_PLAIN_URL: z.url().default('http://localhost:5678'),
  AGENT_RUNTIME_ARN: z.string().min(1).optional(),
  AGENT_RUNTIME_QUALIFIER: z.string().min(1).optional(),

  COPILOTKIT_UPSTREAM_URL: z.url().optional(),

  REGISTRY_SOURCE: z.enum(RegistrySource).default(RegistrySource.S3Yaml),
  REGISTRY_S3_KEY: z.string().min(1).default('registry.yaml'),
  REGISTRY_DB_URL: z.string().optional(),
  REGISTRY_LOCAL_YAML_PATH: z.string().min(1).optional(),
  UPLOADS_BUCKET: z.string().optional(),

  RUN_IN_LAMBDA: z.union([z.string(), z.boolean()])
    .transform((v) => v === true || v === 'true' || v === '1')
    .default(false),
  RUNNER_TYPE: z.enum(RunnerType).default(RunnerType.InMemory),
  THREAD_TABLE_NAME: z.string().optional(),
  SQLITE_DB_PATH: z.string().default('.data/threads.db'),
  THREAD_TTL_DAYS: z.union([z.string(), z.number()])
    .transform((v) => Number.parseInt(String(v), 10))
    .refine((n) => Number.isFinite(n) && n > 0, 'THREAD_TTL_DAYS must be a positive integer')
    .default(30),
}).transform((env) => ({
  ...env,
  COPILOTKIT_UPSTREAM_URL: env.COPILOTKIT_UPSTREAM_URL ?? `http://localhost:${env.PORT}/chat`,
  RUNNER_TYPE: env.RUN_IN_LAMBDA && env.RUNNER_TYPE === RunnerType.InMemory
    ? RunnerType.DynamoDB
    : env.RUNNER_TYPE,
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
  REGISTRY_LOCAL_YAML_PATH,
  UPLOADS_BUCKET,
  RUN_IN_LAMBDA,
  RUNNER_TYPE,
  THREAD_TABLE_NAME,
  SQLITE_DB_PATH,
  THREAD_TTL_DAYS,
} = Object.freeze(envSchema.parse(process.env));
