import { AppError, ErrorCode, isAppError, type AppErrorPayload } from '../errors';

// TanStack Start's server-fn boundary is JSON — thrown Errors lose their
// subclass identity, so results ride an envelope that preserves AppError.
export type ServerFnEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppErrorPayload };

// Extract the success branch before infer so the failure branch doesn't
// distribute into the result union.
export type UnwrapEnvelope<T> = Extract<T, { ok: true }> extends {
  data: infer U;
}
  ? U
  : never;

type NoArgServerFn<E> = () => Promise<E>;
type WithArgServerFn<I, E> = (args: { data: I }) => Promise<E>;

// Two overloads keep TResult inference on both the no-arg and with-arg branches.
export async function callServerFn<E>(
  fn: NoArgServerFn<E>,
): Promise<UnwrapEnvelope<E>>;
export async function callServerFn<I, E>(
  fn: WithArgServerFn<I, E>,
  input: I,
): Promise<UnwrapEnvelope<E>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function callServerFn(fn: any, input?: unknown): Promise<unknown> {
  let raw: unknown;
  try {
    raw = input === undefined ? await fn() : await fn({ data: input });
  } catch (thrown) {
    // Validator errors run before safeEnvelope and reach here as rejections.
    if (thrown instanceof AppError) {
      throw thrown;
    }
    if (isAppErrorLikeThrown(thrown)) {
      throw AppError.fromJSON(thrown);
    }
    const message = thrown instanceof Error ? thrown.message : String(thrown);
    throw new AppError(ErrorCode.InternalError, { message });
  }

  const env = raw as { ok?: unknown; data?: unknown; error?: AppErrorPayload };
  if (env && typeof env === 'object' && 'ok' in env) {
    if (env.ok === true) {
      return env.data;
    }
    if (env.ok === false && env.error) {
      throw AppError.fromJSON(env.error);
    }
  }
  return raw;
}

function isAppErrorLikeThrown(v: unknown): v is AppErrorPayload {
  if (v == null || typeof v !== 'object') {
    return false;
  }
  const r = v as Record<string, unknown>;
  return (
    (r['name'] === 'AppError' || isAppError(v))
    && typeof r['code'] === 'string'
    && typeof r['httpStatus'] === 'number'
    && typeof r['message'] === 'string'
  );
}
