import { z } from 'zod';

import {
  ModelSchema,
  ToolRefSchema,
  UuidSchema,
  VersionSchema,
  type AgentDefinition,
} from './domain/index.js';

export type BranchInput = {
  tenantId: string;
  agentId: string;
  fromVersion: string;
  toVersion: string;
  enabled: boolean;
};

export type BranchResult = {
  target: AgentDefinition;
  etag: string | undefined;
};

export const UpdateAgentFieldsInputSchema = z.object({
  tenantId: UuidSchema,
  agentId: UuidSchema,
  version: VersionSchema,
  patch: z.object({
    description:  z.string().min(1).optional(),
    systemPrompt: z.string().min(1).optional(),
    model:        ModelSchema.optional(),
    tools:        z.array(ToolRefSchema).optional(),
  }).refine(
    (p) => Object.values(p).some((v) => v !== undefined),
    { message: 'patch must include at least one field' },
  ),
});

export type UpdateAgentFieldsInput = z.infer<typeof UpdateAgentFieldsInputSchema>;

export type UpdateAgentFieldsResult = {
  target: AgentDefinition;
  etag: string | undefined;
};

export type SetEnabledInput = {
  tenantId: string;
  agentId: string;
  toVersion: string;
};

export type SetEnabledResult = {
  target: AgentDefinition;
  previousLiveVersion: string | null;
  etag: string | undefined;
};
