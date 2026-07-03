import { getLogger } from '@repo/kit/logger';
import { getRequestContext } from '@repo/kit/request-context.server';

import { AppError, ErrorCode, isAppError } from '#/shared/errors';
import type { ServerFnEnvelope } from '#/shared/server-fn/envelope';

// Validator throws escape this wrapper (they run outside handler scope) —
// callServerFn on the client reconstructs an AppError from those rejections.
export function safeEnvelope<TArgs extends unknown[], TResult>(
  handler: (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<ServerFnEnvelope<TResult>> {
  return async (...args) => {
    const ctx = getRequestContext();
    const requestId = ctx?.requestId;
    try {
      const data = await handler(...args);
      return { ok: true, data };
    } catch (err) {
      if (isAbortError(err)) {
        getLogger().debug('server-fn.aborted', { tag: ctx?.tag, requestId });
        throw err;
      }

      if (isAppError(err)) {
        const stamped = err.requestId == null && requestId != null
          ? AppError.from(err, { requestId })
          : err;
        const kv = {
          tag: ctx?.tag,
          requestId,
          code: stamped.code,
          httpStatus: stamped.httpStatus,
          message: stamped.message,
        };
        const log = getLogger();
        if (stamped.httpStatus >= 500) log.error('server-fn.handled-error', kv);
        else log.warn('server-fn.handled-error', kv);
        return { ok: false, error: stamped.toJSON() };
      }

      getLogger().error('server-fn.unhandled-error', {
        tag: ctx?.tag,
        requestId,
        err: err instanceof Error
          ? { name: err.name, message: err.message, stack: err.stack }
          : String(err),
      });
      const scrubbed = new AppError(ErrorCode.InternalError, {
        message: 'Server error',
        requestId,
      });
      return { ok: false, error: scrubbed.toJSON() };
    }
  };
}

function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException) {
    return err.name === 'AbortError' || err.name === 'TimeoutError';
  }
  if (err != null && typeof err === 'object' && 'name' in err) {
    const n = (err as { name?: unknown }).name;
    return n === 'AbortError' || n === 'TimeoutError';
  }
  return false;
}
