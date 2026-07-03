import { z } from 'zod';

const envSchema = z.object({
  DEV: z.boolean().default(false),
  VITE_TENANT_ID: z.uuid().optional(),
  VITE_TENANT_SLUG: z.string().min(1).default('default'),
  VITE_FRONTEND_URL: z.url().default('http://localhost:3456'),
}).transform((env) => ({
  DEV: env.DEV,
  TENANT_ID: env.VITE_TENANT_ID,
  TENANT_SLUG: env.VITE_TENANT_SLUG,
  FRONTEND_URL: env.VITE_FRONTEND_URL,
}));

export const {
  DEV,
  TENANT_ID,
  TENANT_SLUG,
  FRONTEND_URL,
} = Object.freeze(envSchema.parse((import.meta as ImportMeta).env ?? {}));
