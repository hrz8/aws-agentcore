import { z } from 'zod';

const envSchema = z.object({
  DEV: z.boolean().default(false),
}).transform((env) => ({
  DEV: env.DEV,
}));

export const {
  DEV,
} = Object.freeze(envSchema.parse((import.meta as ImportMeta).env ?? {}));
