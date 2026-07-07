import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import {
  SKILL_NAME_REGEX,
  SkillSourceKind,
  type SkillSource,
} from '@repo/skills/domain';
import {
  SkillNotFoundError,
  SkillPathError,
  SkillValidationError,
} from '@repo/skills/errors';

import { withContext } from '#/server/_lib/middleware';
import { safeEnvelope } from '#/server/_lib/server-fn/envelope.server';
import { resolveTenantScope } from '#/server/_lib/tenant/resolve';
import { zodInput } from '#/server/_lib/zod-input';
import { getSkillsRepo } from '#/server/repositories';
import { AppError, ErrorCode } from '#/shared/errors';
import { WireScopeSchema } from '#/shared/scope';

const UploadSchema = z.object({
  scope: WireScopeSchema,
  kind: z.enum([SkillSourceKind.Zip, SkillSourceKind.SkillMd]),
  filename: z.string().max(200).optional(),
  contentBase64: z.string().min(1),
});

export const uploadSkillServerFn = createServerFn({ method: 'POST' })
  .middleware([withContext])
  .validator(zodInput(UploadSchema))
  .handler(
    safeEnvelope(async ({ data }) => {
      const scope = await resolveTenantScope(data.scope);
      const bytes = new Uint8Array(Buffer.from(data.contentBase64, 'base64'));
      const source: SkillSource = { kind: data.kind, bytes };
      try {
        return await getSkillsRepo().install(scope, source);
      } catch (err) {
        if (err instanceof SkillValidationError) {
          throw new AppError(ErrorCode.SkillValidationFailed, {
            message: err.message,
            cause: err,
          });
        }
        throw new AppError(ErrorCode.SkillUploadFailed, {
          message: 'Skill upload failed',
          cause: err,
        });
      }
    }),
  );

const ScopeOnlySchema = z.object({ scope: WireScopeSchema });

export const listSkillsServerFn = createServerFn({ method: 'GET' })
  .middleware([withContext])
  .validator(zodInput(ScopeOnlySchema))
  .handler(
    safeEnvelope(async ({ data }) => {
      const scope = await resolveTenantScope(data.scope);
      return { skills: await getSkillsRepo().list(scope) };
    }),
  );

const NamedSkillSchema = z.object({
  scope: WireScopeSchema,
  name: z.string().regex(SKILL_NAME_REGEX, 'invalid skill name'),
});

export const getSkillServerFn = createServerFn({ method: 'GET' })
  .middleware([withContext])
  .validator(zodInput(NamedSkillSchema))
  .handler(
    safeEnvelope(async ({ data }) => {
      const scope = await resolveTenantScope(data.scope);
      try {
        return await getSkillsRepo().get(scope, data.name);
      } catch (err) {
        if (err instanceof SkillNotFoundError) {
          throw new AppError(ErrorCode.NotFound, { message: err.message, cause: err });
        }
        if (err instanceof SkillValidationError) {
          throw new AppError(ErrorCode.SkillNameInvalid, {
            message: err.message,
            cause: err,
          });
        }
        throw err;
      }
    }),
  );

export const getSkillContentServerFn = createServerFn({ method: 'GET' })
  .middleware([withContext])
  .validator(zodInput(NamedSkillSchema))
  .handler(
    safeEnvelope(async ({ data }) => {
      const scope = await resolveTenantScope(data.scope);
      try {
        return await getSkillsRepo().getContent(scope, data.name);
      } catch (err) {
        if (err instanceof SkillNotFoundError) {
          throw new AppError(ErrorCode.NotFound, { message: err.message, cause: err });
        }
        if (err instanceof SkillValidationError) {
          throw new AppError(ErrorCode.SkillNameInvalid, {
            message: err.message,
            cause: err,
          });
        }
        throw err;
      }
    }),
  );

const UpdateSkillMdSchema = z.object({
  scope: WireScopeSchema,
  name: z.string().regex(SKILL_NAME_REGEX, 'invalid skill name'),
  skillMd: z.string().min(1).max(1_000_000),
});

export const updateSkillMdServerFn = createServerFn({ method: 'POST' })
  .middleware([withContext])
  .validator(zodInput(UpdateSkillMdSchema))
  .handler(
    safeEnvelope(async ({ data }) => {
      const scope = await resolveTenantScope(data.scope);
      try {
        return await getSkillsRepo().updateSkillMd(scope, data.name, data.skillMd);
      } catch (err) {
        if (err instanceof SkillNotFoundError) {
          throw new AppError(ErrorCode.NotFound, { message: err.message, cause: err });
        }
        if (err instanceof SkillValidationError) {
          throw new AppError(ErrorCode.SkillValidationFailed, {
            message: err.message,
            cause: err,
          });
        }
        throw err;
      }
    }),
  );

export const deleteSkillServerFn = createServerFn({ method: 'POST' })
  .middleware([withContext])
  .validator(zodInput(NamedSkillSchema))
  .handler(
    safeEnvelope(async ({ data }) => {
      const scope = await resolveTenantScope(data.scope);
      try {
        return await getSkillsRepo().remove(scope, data.name);
      } catch (err) {
        if (err instanceof SkillNotFoundError) {
          throw new AppError(ErrorCode.NotFound, { message: err.message, cause: err });
        }
        throw err;
      }
    }),
  );

const SkillSignSchema = z.object({
  scope: WireScopeSchema,
  name: z.string().regex(SKILL_NAME_REGEX, 'invalid skill name'),
  path: z.string().min(1).max(512),
});

export const signSkillPathServerFn = createServerFn({ method: 'GET' })
  .middleware([withContext])
  .validator(zodInput(SkillSignSchema))
  .handler(
    safeEnvelope(async ({ data }) => {
      const scope = await resolveTenantScope(data.scope);
      try {
        return await getSkillsRepo().signResource({
          scope,
          name: data.name,
          path: data.path,
        });
      } catch (err) {
        if (err instanceof SkillPathError) {
          throw new AppError(ErrorCode.BadRequest, { message: err.message, cause: err });
        }
        throw err;
      }
    }),
  );

const BranchSkillsSchema = z.object({
  scope: WireScopeSchema,
  to: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,31}$/, 'invalid target version format'),
});

export const branchSkillsServerFn = createServerFn({ method: 'POST' })
  .middleware([withContext])
  .validator(zodInput(BranchSkillsSchema))
  .handler(
    safeEnvelope(async ({ data }) => {
      const scope = await resolveTenantScope(data.scope);
      try {
        return await getSkillsRepo().branch({ scope, toVersion: data.to });
      } catch (err) {
        if (err instanceof SkillValidationError) {
          throw new AppError(ErrorCode.Conflict, { message: err.message, cause: err });
        }
        throw err;
      }
    }),
  );
