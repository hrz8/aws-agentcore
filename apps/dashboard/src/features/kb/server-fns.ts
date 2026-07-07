import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import {
  EmptyContentError,
  KbConflictError,
  KbNotConfiguredError,
  KbNotFoundError,
  KbScopeError,
  KbValidationError,
  WebIngestRejectedError,
} from '@repo/kb/errors';
import { HttpError } from '@repo/kit/http';

import { withContext } from '#/server/_lib/middleware';
import { safeEnvelope } from '#/server/_lib/server-fn/envelope.server';
import { resolveTenantScope } from '#/server/_lib/tenant/resolve';
import { zodInput } from '#/server/_lib/zod-input';
import { getKbRepo, getWebIngestService } from '#/server/repositories';
import { AppError, ErrorCode } from '#/shared/errors';
import { WireScopeSchema } from '#/shared/scope';

const PresignSchema = z.object({
  scope: WireScopeSchema,
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1),
});

export const presignUploadServerFn = createServerFn({ method: 'POST' })
  .middleware([withContext])
  .validator(zodInput(PresignSchema))
  .handler(
    safeEnvelope(async ({ data }) => {
      const scope = await resolveTenantScope(data.scope);
      try {
        return await getKbRepo().presignUpload(scope, {
          filename: data.filename,
          contentType: data.contentType,
        });
      } catch (err) {
        throw mapKbError(err);
      }
    }),
  );

const ScopeOnlySchema = z.object({ scope: WireScopeSchema });

export const startIngestionServerFn = createServerFn({ method: 'POST' })
  .middleware([withContext])
  .validator(zodInput(ScopeOnlySchema))
  .handler(
    safeEnvelope(async ({ data }) => {
      const scope = await resolveTenantScope(data.scope);
      return getKbRepo().startIngestion(scope);
    }),
  );

const JobSchema = z.object({ scope: WireScopeSchema, id: z.string().min(1) });

export const kbJobServerFn = createServerFn({ method: 'GET' })
  .middleware([withContext])
  .validator(zodInput(JobSchema))
  .handler(
    safeEnvelope(async ({ data }) => {
      const scope = await resolveTenantScope(data.scope);
      return getKbRepo().getIngestionJob(scope, data.id);
    }),
  );

const SignSchema = z.object({
  scope: WireScopeSchema,
  uri: z.string().regex(/^s3:\/\//, 'uri must start with s3://'),
  page: z.number().int().positive().optional(),
});

export const kbSignServerFn = createServerFn({ method: 'GET' })
  .middleware([withContext])
  .validator(zodInput(SignSchema))
  .handler(
    safeEnvelope(async ({ data }) => {
      const scope = await resolveTenantScope(data.scope);
      try {
        return await getKbRepo().presignDownload(scope, {
          uri: data.uri,
          page: data.page,
        });
      } catch (err) {
        throw mapKbError(err);
      }
    }),
  );

const AddWebUrlSchema = z.object({
  scope: WireScopeSchema,
  url: z.string().url(),
  sitemap: z.boolean().optional(),
});

export const addWebUrlServerFn = createServerFn({ method: 'POST' })
  .middleware([withContext])
  .validator(zodInput(AddWebUrlSchema))
  .handler(
    safeEnvelope(async ({ data }) => {
      const scope = await resolveTenantScope(data.scope);
      try {
        if (data.sitemap) {
          return await getWebIngestService().crawlSitemap(scope, data.url);
        }
        return await getWebIngestService().ingestUrl(scope, data.url);
      } catch (err) {
        throw mapIngestError(err);
      }
    }),
  );

export const listWebUrlsServerFn = createServerFn({ method: 'GET' })
  .middleware([withContext])
  .validator(zodInput(ScopeOnlySchema))
  .handler(
    safeEnvelope(async ({ data }) => {
      const scope = await resolveTenantScope(data.scope);
      return { documents: await getKbRepo().listWebDocuments(scope) };
    }),
  );

const DeleteWebUrlSchema = z.object({
  scope: WireScopeSchema,
  docId: z.string().min(1),
});

export const deleteWebUrlServerFn = createServerFn({ method: 'POST' })
  .middleware([withContext])
  .validator(zodInput(DeleteWebUrlSchema))
  .handler(
    safeEnvelope(async ({ data }) => {
      const scope = await resolveTenantScope(data.scope);
      try {
        return await getKbRepo().deleteWebDocument(scope, data.docId);
      } catch (err) {
        throw mapKbError(err);
      }
    }),
  );

const RefreshWebUrlSchema = z.object({
  scope: WireScopeSchema,
  docId: z.string().min(1),
});

export const refreshWebUrlServerFn = createServerFn({ method: 'POST' })
  .middleware([withContext])
  .validator(zodInput(RefreshWebUrlSchema))
  .handler(
    safeEnvelope(async ({ data }) => {
      const scope = await resolveTenantScope(data.scope);
      try {
        return await getWebIngestService().refreshDocument(scope, data.docId);
      } catch (err) {
        throw mapIngestError(err);
      }
    }),
  );

export const listDocumentsServerFn = createServerFn({ method: 'GET' })
  .middleware([withContext])
  .validator(zodInput(ScopeOnlySchema))
  .handler(
    safeEnvelope(async ({ data }) => {
      const scope = await resolveTenantScope(data.scope);
      return { documents: await getKbRepo().listDocuments(scope) };
    }),
  );

const DeleteDocumentSchema = z.object({
  scope: WireScopeSchema,
  key: z.string().min(1),
});

export const deleteDocumentServerFn = createServerFn({ method: 'POST' })
  .middleware([withContext])
  .validator(zodInput(DeleteDocumentSchema))
  .handler(
    safeEnvelope(async ({ data }) => {
      const scope = await resolveTenantScope(data.scope);
      const repo = getKbRepo();
      try {
        await repo.deleteDocument(scope, data.key);
      } catch (err) {
        throw mapKbError(err);
      }
      try {
        const ingestionJob = await repo.startIngestion(scope);
        return { ingestionJob };
      } catch (err) {
        throw mapKbError(err);
      }
    }),
  );

const BranchKbSchema = z.object({
  scope: WireScopeSchema,
  to: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,31}$/, 'invalid target version format'),
  sync: z.boolean().default(true),
});

export const branchKbServerFn = createServerFn({ method: 'POST' })
  .middleware([withContext])
  .validator(zodInput(BranchKbSchema))
  .handler(
    safeEnvelope(async ({ data }) => {
      const scope = await resolveTenantScope(data.scope);
      try {
        return await getKbRepo().branch(scope, { toVersion: data.to, sync: data.sync });
      } catch (err) {
        throw mapKbError(err);
      }
    }),
  );

function mapKbError(err: unknown): AppError {
  if (err instanceof KbNotFoundError) {
    return new AppError(ErrorCode.NotFound, { message: err.message, cause: err });
  }
  if (err instanceof KbConflictError) {
    return new AppError(ErrorCode.Conflict, { message: err.message, cause: err });
  }
  if (err instanceof KbValidationError) {
    return new AppError(ErrorCode.BadRequest, { message: err.message, cause: err });
  }
  if (err instanceof KbScopeError) {
    return new AppError(ErrorCode.Forbidden, { message: err.message, cause: err });
  }
  if (err instanceof KbNotConfiguredError) {
    return new AppError(ErrorCode.InternalError, {
      message: 'KB is not configured for this environment',
      cause: err,
    });
  }
  return new AppError(ErrorCode.InternalError, {
    message: err instanceof Error ? err.message : String(err),
    cause: err,
  });
}

// Only echo err.message on typed sub-errors whose message shape is reviewed;
// foreign errors get a fixed message + cause-in-logs.
function mapIngestError(err: unknown): AppError {
  if (err instanceof EmptyContentError) {
    return new AppError(ErrorCode.KbEmptyContent, { message: err.message, cause: err });
  }
  if (err instanceof WebIngestRejectedError) {
    return new AppError(ErrorCode.KbIngestForbidden, {
      message: err.message,
      cause: err,
    });
  }
  if (err instanceof HttpError) {
    if (err.kind === 'http' && err.status === 403) {
      return new AppError(ErrorCode.KbIngestForbidden, {
        message: 'Upstream refused ingestion (forbidden)',
        cause: err,
      });
    }
    if (err.kind === 'http' && err.status === 404) {
      return new AppError(ErrorCode.NotFound, {
        message: 'Upstream returned 404 for the requested URL',
        cause: err,
      });
    }
    if (err.kind === 'timeout') {
      return new AppError(ErrorCode.KbIngestTimeout, {
        message: 'Upstream timed out during ingestion',
        cause: err,
      });
    }
  }
  return new AppError(ErrorCode.KbIngestFailed, {
    message: 'Ingestion failed',
    cause: err,
  });
}
