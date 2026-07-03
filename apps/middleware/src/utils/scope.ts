import { isUuid } from '@repo/kit/identity';
import { z } from 'zod';

const scopeHeadersSchema = z.object({
  tenantId: z
    .string({ error: 'x-tenant-id header required' })
    .refine(isUuid, 'x-tenant-id must be a UUID'),
  agentId: z
    .string({ error: 'x-agent-id header required' })
    .refine(isUuid, 'x-agent-id must be a UUID'),
  agentVersion: z.string().optional().transform((v) => (v && v.length > 0 ? v : null)),
});

export type ScopeHeaders = z.infer<typeof scopeHeadersSchema>;

export type ScopeHeaderResult =
  | { ok: true; scope: ScopeHeaders }
  | { ok: false; status: number; error: string };

export function readScopeFromHeaders(headers: {
  tenantId?: string;
  agentId?: string;
  agentVersion?: string;
}): ScopeHeaderResult {
  const parsed = scopeHeadersSchema.safeParse(headers);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: parsed.error.issues[0]?.message ?? 'invalid scope headers',
    };
  }
  return {
    ok: true,
    scope: parsed.data,
  };
}
