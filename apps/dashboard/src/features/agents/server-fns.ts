import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import {
  AgentNotFoundError,
  BranchError,
  ModelSchema,
  RegistryValidationError,
  ToolRefSchema,
} from '@repo/registry';

import { withContext } from '#/server/_lib/middleware';
import { safeEnvelope } from '#/server/_lib/server-fn/envelope.server';
import { resolveTenantScope } from '#/server/_lib/tenant/resolve';
import { zodInput } from '#/server/_lib/zod-input';
import { getRegistryRepo } from '#/server/repositories';
import { AppError, ErrorCode } from '#/shared/errors';
import { TenantSlugSchema, WireScopeSchema } from '#/shared/scope';

export const listTenantsServerFn = createServerFn({ method: 'GET' })
  .middleware([withContext])
  .handler(
    safeEnvelope(async () => {
      const repo = await getRegistryRepo();
      return { tenants: await repo.tenants.list() };
    }),
  );

const ListAgentsSchema = z.object({ tenantSlug: TenantSlugSchema });

export const listAgentsServerFn = createServerFn({ method: 'GET' })
  .middleware([withContext])
  .validator(zodInput(ListAgentsSchema))
  .handler(
    safeEnvelope(async ({ data }) => {
      const repo = await getRegistryRepo();
      const tenants = await repo.tenants.list();
      const tenant = tenants.find((t) => t.tenantSlug === data.tenantSlug);
      if (!tenant) {
        throw new AppError(ErrorCode.TenantNotFound, {
          message: `unknown tenant: ${data.tenantSlug}`,
          meta: { tenantSlug: data.tenantSlug },
        });
      }
      return { agents: await repo.agents.identities(tenant.tenantId) };
    }),
  );

export const getRegistryServerFn = createServerFn({ method: 'GET' })
  .middleware([withContext])
  .handler(
    safeEnvelope(async () => {
      const repo = await getRegistryRepo();
      if (!repo.rawText) {
        throw new AppError(ErrorCode.RegistryNotEditable, {
          message: 'current registry strategy has no raw-text edit surface',
        });
      }
      const { text, etag } = await repo.rawText.read();
      return { text, etag: etag ?? null };
    }),
  );

const PutRegistrySchema = z.object({ text: z.string().min(1) });

export const putRegistryServerFn = createServerFn({ method: 'POST' })
  .middleware([withContext])
  .validator(zodInput(PutRegistrySchema))
  .handler(
    safeEnvelope(async ({ data }) => {
      const repo = await getRegistryRepo();
      if (!repo.rawText) {
        throw new AppError(ErrorCode.RegistryNotEditable, {
          message: 'current registry strategy has no raw-text edit surface',
        });
      }
      try {
        const { etag } = await repo.rawText.write(data.text);
        return { ok: true as const, etag: etag ?? null };
      } catch (err) {
        if (err instanceof RegistryValidationError) {
          throw new AppError(ErrorCode.RegistryValidationFailed, {
            message: err.message,
            cause: err,
          });
        }
        throw err;
      }
    }),
  );

export const listBuiltinToolsServerFn = createServerFn({ method: 'GET' })
  .middleware([withContext])
  .handler(
    safeEnvelope(async () => {
      const repo = await getRegistryRepo();
      return { tools: await repo.builtinTools.list() };
    }),
  );

const GetAgentDetailsSchema = z.object({ scope: WireScopeSchema });

export const getAgentDetailsServerFn = createServerFn({ method: 'GET' })
  .middleware([withContext])
  .validator(zodInput(GetAgentDetailsSchema))
  .handler(
    safeEnvelope(async ({ data }) => {
      const scope = await resolveTenantScope(data.scope);
      const repo = await getRegistryRepo();
      const row = await repo.agents.getByIds(scope.tenantId, scope.agentId, scope.version);
      if (!row) {
        throw new AppError(ErrorCode.AgentNotFound, {
          message: 'agent version not found',
          meta: {
            tenantSlug: scope.tenantSlug,
            agentId: scope.agentId,
            version: scope.version,
          },
        });
      }
      return {
        description: row.description,
        systemPrompt: row.systemPrompt,
        model: row.model,
        tools: row.tools,
      };
    }),
  );

const AgentPatchSchema = z.object({
  description: z.string().min(1).max(1_000).optional(),
  systemPrompt: z.string().min(1).max(64_000).optional(),
  model: ModelSchema.optional(),
  tools: z.array(ToolRefSchema).max(64).optional(),
}).refine(
  (p) => Object.values(p).some((v) => v !== undefined),
  { message: 'patch must include at least one field' },
);

const UpdateAgentConfigSchema = z.object({
  scope: WireScopeSchema,
  patch: AgentPatchSchema,
});

export const updateAgentConfigServerFn = createServerFn({ method: 'POST' })
  .middleware([withContext])
  .validator(zodInput(UpdateAgentConfigSchema))
  .handler(
    safeEnvelope(async ({ data }) => {
      const scope = await resolveTenantScope(data.scope);
      const repo = await getRegistryRepo();
      try {
        const result = await repo.agents.updateFields({
          tenantId: scope.tenantId,
          agentId: scope.agentId,
          version: scope.version,
          patch: data.patch,
        });
        return {
          ok: true as const,
          target: {
            description: result.target.description,
            systemPrompt: result.target.systemPrompt,
            model: result.target.model,
            tools: result.target.tools,
          },
          etag: result.etag ?? null,
        };
      } catch (err) {
        if (err instanceof AgentNotFoundError) {
          throw new AppError(ErrorCode.AgentNotFound, { message: err.message, cause: err });
        }
        if (err instanceof RegistryValidationError) {
          throw new AppError(ErrorCode.RegistryValidationFailed, {
            message: err.message,
            cause: err,
          });
        }
        throw err;
      }
    }),
  );

const BranchRegistrySchema = z.object({
  scope: WireScopeSchema,
  toVersion: z.string().min(1),
  enabled: z.boolean(),
});

export const branchRegistryServerFn = createServerFn({ method: 'POST' })
  .middleware([withContext])
  .validator(zodInput(BranchRegistrySchema))
  .handler(
    safeEnvelope(async ({ data }) => {
      const scope = await resolveTenantScope(data.scope);
      if (scope.version === data.toVersion) {
        throw new AppError(ErrorCode.RegistryBranchSameVersion, {
          message: 'fromVersion equals toVersion',
        });
      }
      try {
        const repo = await getRegistryRepo();
        const result = await repo.agents.branch({
          tenantId: scope.tenantId,
          agentId: scope.agentId,
          fromVersion: scope.version,
          toVersion: data.toVersion,
          enabled: data.enabled,
        });
        return {
          ok: true as const,
          target: {
            tenantId: result.target.tenantId,
            tenantSlug: result.target.tenantSlug,
            agentId: result.target.agentId,
            agentSlug: result.target.agentSlug,
            version: result.target.version,
            enabled: result.target.enabled,
          },
          etag: result.etag ?? null,
        };
      } catch (err) {
        if (err instanceof BranchError) {
          const code = err.status === 409
            ? ErrorCode.RegistryBranchConflict
            : ErrorCode.BadRequest;
          throw new AppError(code, { message: err.message, cause: err });
        }
        if (err instanceof RegistryValidationError) {
          throw new AppError(ErrorCode.RegistryValidationFailed, {
            message: err.message,
            cause: err,
          });
        }
        throw err;
      }
    }),
  );
