import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const configSchema = z.object({
  AWS_REGION: z.string().min(1),
  AWS_ACCOUNT_ID: z.string().regex(/^\d{12}$/, 'AWS_ACCOUNT_ID must be a 12-digit account id'),
});

export const {
  AWS_REGION,
  AWS_ACCOUNT_ID,
} = Object.freeze(configSchema.parse(process.env));

export const Stages = {
  Dev: 'Dev',
  Prod: 'Prod',
} as const;

export type Stage = typeof Stages[keyof typeof Stages];
