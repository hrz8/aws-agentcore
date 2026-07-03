import { ERROR_CODE_STATUS, ErrorCode } from './error-codes';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

// SECURITY: `meta` is serialized to the client verbatim — do not put session
// tokens, credentials, PII, presigned URLs, or raw upstream error messages
// here. Use `cause` for diagnostic detail (log-only, never serialized).
export type AppErrorPayload = {
  code: ErrorCode;
  httpStatus: number;
  message: string;
  requestId?: string;
  meta?: Record<string, JsonValue>;
};

export type AppErrorOptions = {
  message?: string;
  requestId?: string;
  meta?: Record<string, JsonValue>;
  cause?: unknown;
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly requestId?: string;
  readonly meta?: Record<string, JsonValue>;

  constructor(code: ErrorCode, options: AppErrorOptions = {}) {
    const message = options.message ?? code;
    super(message, options.cause != null ? { cause: options.cause } : undefined);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = ERROR_CODE_STATUS[code];
    this.requestId = options.requestId;
    this.meta = options.meta;
  }

  toJSON(): AppErrorPayload {
    const payload: AppErrorPayload = {
      code: this.code,
      httpStatus: this.httpStatus,
      message: this.message,
    };
    if (this.requestId != null) {
      payload.requestId = this.requestId;
    }
    if (this.meta != null) {
      payload.meta = this.meta;
    }
    return payload;
  }

  static fromJSON(payload: AppErrorPayload): AppError {
    return new AppError(payload.code, {
      message: payload.message,
      requestId: payload.requestId,
      meta: payload.meta,
    });
  }

  static from(err: unknown, opts: { requestId?: string } = {}): AppError {
    if (isAppError(err)) {
      if (opts.requestId && !err.requestId) {
        return new AppError(err.code, {
          message: err.message,
          requestId: opts.requestId,
          meta: err.meta,
          cause: err.cause,
        });
      }
      return err;
    }
    const message = err instanceof Error ? err.message : String(err);
    return new AppError(ErrorCode.InternalError, {
      message,
      requestId: opts.requestId,
      cause: err,
    });
  }
}

// Vite HMR can load this module twice; instanceof fails across boundaries.
export function isAppError(value: unknown): value is AppError {
  if (value instanceof AppError) {
    return true;
  }
  if (value == null || typeof value !== 'object') {
    return false;
  }
  const r = value as Record<string, unknown>;
  return (
    r['name'] === 'AppError'
    && typeof r['code'] === 'string'
    && typeof r['httpStatus'] === 'number'
    && typeof r['message'] === 'string'
  );
}
