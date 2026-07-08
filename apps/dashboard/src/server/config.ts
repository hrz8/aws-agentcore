import * as dotenv from 'dotenv';
import { z } from 'zod';

import { LogLevel } from '@repo/kit/logger';
import type { PinoLoggerConfig } from '@repo/kit/logger.server';

dotenv.config({ quiet: true });

export const RegistrySource = {
  S3Yaml: 's3-yaml',
  LocalYaml: 'local-yaml',
  DbPostgres: 'db-postgres',
} as const;
export type RegistrySource = typeof RegistrySource[keyof typeof RegistrySource];

export type KbStage = {
  uploadsBucket: string;
  kbId: string;
  s3DataSourceId: string;
  webDataSourceId: string | undefined;
};
export type SkillsStage = {
  uploadsBucket: string;
};

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  AWS_REGION: z.string().min(1).default('us-east-1'),
  AWS_ACCOUNT_ID: z.string().min(1).optional(),

  UPLOADS_BUCKET: z.string().min(1).optional(),
  KB_ID: z.string().min(1).optional(),
  KB_S3_DATA_SOURCE_ID: z.string().min(1).optional(),
  KB_WEB_DATA_SOURCE_ID: z.string().min(1).optional(),

  REGISTRY_SOURCE: z.enum(RegistrySource).default(RegistrySource.S3Yaml),
  REGISTRY_S3_KEY: z.string().min(1).default('registry/agents.yaml'),
  REGISTRY_DB_URL: z.string().min(1).optional(),
  REGISTRY_LOCAL_YAML_PATH: z.string().min(1).optional(),
  WIDGET_DEMO_URL: z.url().default('http://localhost:4174/widget-demo.html'),
  MIDDLEWARE_URL: z.url().default('http://localhost:7890'),

  LOG_LEVEL: z.enum(LogLevel).optional(),
  LOG_PRETTY: z
    .string()
    .optional()
    .transform((v) => {
      if (v == null) return undefined;
      const norm = v.trim().toLowerCase();
      if (['1', 'true', 'yes', 'on'].includes(norm)) return true;
      if (['0', 'false', 'no', 'off', ''].includes(norm)) return false;
      return false;
    }),
}).superRefine((env, ctx) => {
  const keys = [
    'UPLOADS_BUCKET',
    'KB_ID',
    'KB_S3_DATA_SOURCE_ID',
  ] as const;
  const missing = keys.filter((k) => env[k] === undefined);
  if (missing.length > 0 && missing.length < keys.length) {
    ctx.addIssue({
      code: 'custom',
      message: `KB stage is all-or-none. Missing: ${missing.join(', ')}.`,
    });
  }
});

const ENV = Object.freeze(envSchema.parse(process.env));

export const {
  AWS_REGION,
  AWS_ACCOUNT_ID,
  UPLOADS_BUCKET,
  KB_ID,
  KB_S3_DATA_SOURCE_ID,
  KB_WEB_DATA_SOURCE_ID,
  REGISTRY_SOURCE,
  REGISTRY_S3_KEY,
  REGISTRY_DB_URL,
  REGISTRY_LOCAL_YAML_PATH,
  WIDGET_DEMO_URL,
  MIDDLEWARE_URL,
} = ENV;

export const KB_STAGE: KbStage | null = ENV.UPLOADS_BUCKET && ENV.KB_ID && ENV.KB_S3_DATA_SOURCE_ID
  ? {
      uploadsBucket: ENV.UPLOADS_BUCKET,
      kbId: ENV.KB_ID,
      s3DataSourceId: ENV.KB_S3_DATA_SOURCE_ID,
      webDataSourceId: ENV.KB_WEB_DATA_SOURCE_ID,
    }
  : null;

export const SKILLS_STAGE: SkillsStage | null = ENV.UPLOADS_BUCKET
  ? {
    uploadsBucket: ENV.UPLOADS_BUCKET,
  }
  : null;

const IS_PROD = ENV.NODE_ENV === 'production';
export const LOG_CONFIG: PinoLoggerConfig = {
  level: ENV.LOG_LEVEL ?? (IS_PROD ? LogLevel.Info : LogLevel.Debug),
  pretty: ENV.LOG_PRETTY ?? !IS_PROD,
  base: { app: 'dashboard' },
};
