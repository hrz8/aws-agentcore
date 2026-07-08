export class HttpError extends Error {
  constructor(
    readonly url: string,
    readonly kind: 'timeout' | 'http' | 'connection',
    readonly status: number | null,
    message?: string,
  ) {
    super(message ?? `${kind} ${url}${status ? ` (HTTP ${status})` : ''}`);
    this.name = 'HttpError';
  }
}

export type HttpOptions = {
  timeoutMs?: number;
  headers?: Record<string, string>;
  userAgent?: string;
  signal?: AbortSignal;
};

const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (compatible; nd8/0.1; +https://github.com/trinitywizards)';

async function send(method: string, url: string, opts: HttpOptions = {}): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  try {
    return await fetch(url, {
      method,
      headers: {
        'user-agent': opts.userAgent ?? DEFAULT_USER_AGENT,
        ...(opts.headers ?? {}),
      },
      redirect: 'follow',
      signal: opts.signal ?? AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new HttpError(url, 'timeout', null, `timed out after ${timeoutMs}ms`);
    }
    throw new HttpError(url, 'connection', null, err instanceof Error ? err.message : String(err));
  }
}

export function httpGet(url: string, opts?: HttpOptions): Promise<Response> {
  return send('GET', url, opts);
}

export async function httpGetJson<T>(url: string, opts?: HttpOptions): Promise<T> {
  const res = await httpGet(url, opts);
  if (!res.ok) {
    throw new HttpError(url, 'http', res.status);
  }
  return (await res.json()) as T;
}

export async function httpGetText(url: string, opts?: HttpOptions): Promise<string> {
  const res = await httpGet(url, opts);
  if (!res.ok) {
    throw new HttpError(url, 'http', res.status);
  }
  return res.text();
}

export async function httpGetBytes(url: string, opts?: HttpOptions): Promise<ArrayBuffer> {
  const res = await httpGet(url, opts);
  if (!res.ok) {
    throw new HttpError(url, 'http', res.status);
  }
  return res.arrayBuffer();
}
