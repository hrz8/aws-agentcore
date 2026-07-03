import { createMiddleware } from '@tanstack/react-start';

import { getLogger } from '@repo/kit/logger';
import {
  getRequestContext,
  newRequestId,
  runWithRequestContext,
} from '@repo/kit/request-context.server';

import { AppError, ErrorCode, isAppError } from '#/shared/errors';

export const withContext = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const requestId = newRequestId();
    const tag = getRequestContext()?.tag ?? 'server-fn';

    return runWithRequestContext({ requestId, tag }, async () => {
      const log = getLogger().child({ requestId, tag });
      log.debug('server-fn.enter');
      const t0 = performance.now();
      try {
        const result = await next({ context: { requestId, log } });
        const dur = Math.round(performance.now() - t0);
        log.debug('server-fn.exit', { dur });
        return result;
      } catch (err) {
        if (isAbortError(err)) {
          log.debug('server-fn.aborted');
          throw err;
        }
        if (isAppError(err)) {
          if (err.requestId == null) throw AppError.from(err, { requestId });
          throw err;
        }
        log.error('server-fn.unhandled', {
          err: err instanceof Error
            ? { name: err.name, message: err.message, stack: err.stack }
            : String(err),
        });
        throw new AppError(ErrorCode.InternalError, {
          message: 'Server error',
          requestId,
        });
      }
    });
  },
);

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
