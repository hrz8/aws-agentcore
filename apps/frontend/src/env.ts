import { z } from 'zod';

const envSchema = z.object({
  DEV: z.boolean().default(false),
  VITE_AGENT_URL: z.url().default('http://localhost:7890/copilotkit'),
  VITE_MIDDLEWARE_URL: z.url().default('http://localhost:7890'),
}).transform((env) => ({
  DEV: env.DEV,
  AGENT_URL: env.VITE_AGENT_URL,
  MIDDLEWARE_URL: env.VITE_MIDDLEWARE_URL,
}));

export const {
  DEV,
  AGENT_URL,
  MIDDLEWARE_URL,
} = Object.freeze(envSchema.parse(import.meta.env ?? {}));
