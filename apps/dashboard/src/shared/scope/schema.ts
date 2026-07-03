import { z } from 'zod';

import { isUuid } from '@repo/kit/identity';

export const TenantSlugSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{0,62}[a-z0-9]$/, 'invalid tenant slug');

// Client never sends tenantId — it's spoofable. Slug resolves server-side.
export const WireScopeSchema = z.object({
  tenantSlug: TenantSlugSchema,
  agentId: z.string().refine(isUuid, 'agentId must be UUID'),
  version: z.string().min(1),
});

export type WireScope = z.infer<typeof WireScopeSchema>;

export type ResolvedServerScope = {
  tenantId: string;
  tenantSlug: string;
  agentId: string;
  version: string;
};
