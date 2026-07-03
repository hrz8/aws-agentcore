import { z } from 'zod';

const envSchema = z.object({
  DEV: z.boolean().default(false),
  VITE_AGENT_URL: z.url().default('http://localhost:7890/copilotkit'),
  VITE_MIDDLEWARE_URL: z.url().default('http://localhost:7890'),
  VITE_TENANT_ID: z.uuid('VITE_TENANT_ID must be a UUID'),
}).transform((env) => ({
  DEV: env.DEV,
  AGENT_URL: env.VITE_AGENT_URL,
  MIDDLEWARE_URL: env.VITE_MIDDLEWARE_URL,
  TENANT_ID: env.VITE_TENANT_ID,
}));

export const {
  DEV,
  AGENT_URL,
  MIDDLEWARE_URL,
  TENANT_ID,
} = Object.freeze(envSchema.parse(import.meta.env ?? {}));
