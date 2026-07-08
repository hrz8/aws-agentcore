import { z } from 'zod';

export const Nd8ConfigSchema = z.object({
  tenantId: z.uuid('nd8Config.tenantId must be a UUID'),
  agentId: z.uuid('nd8Config.agentId must be a UUID'),
  agentVersion: z.string().min(1, 'nd8Config.agentVersion is required'),
  agentUrl: z.url('nd8Config.agentUrl must be a URL'),
  middlewareUrl: z.url('nd8Config.middlewareUrl must be a URL').optional(),
  title: z.string().default('Assistant'),
  position: z.enum(['bottom-right', 'bottom-left']).default('bottom-right'),
  initiallyOpen: z.boolean().default(false),
  theme: z
    .object({
      primary: z.string().optional(),
    })
    .partial()
    .default({}),
  actorId: z.string().optional(),
  targetElement: z.union([z.string(), z.instanceof(HTMLElement)]).optional(),
});

export type Nd8Config = z.infer<typeof Nd8ConfigSchema>;
export type Nd8ConfigInput = z.input<typeof Nd8ConfigSchema>;

export function resolveConfig(input: unknown): Nd8Config {
  return Nd8ConfigSchema.parse(input);
}

export function buildHeaders(cfg: Nd8Config, actorId: string): Record<string, string> {
  return {
    'x-tenant-id': cfg.tenantId,
    'x-agent-id': cfg.agentId,
    'x-agent-version': cfg.agentVersion,
    'x-actor-id': actorId,
  };
}
