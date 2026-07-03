export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    readonly body: string,
  ) {
    super(`HTTP ${status} ${url}${body ? `: ${body}` : ''}`);
    this.name = 'HttpError';
  }
}

type Init = Omit<RequestInit, 'method' | 'body'>;

async function send(
  method: string,
  url: string,
  init: Init,
  body?: BodyInit,
): Promise<Response> {
  const res = await fetch(url, { ...init, method, body });
  if (!res.ok) {
    throw new HttpError(res.status, url, await res.text().catch(() => ''));
  }
  return res;
}

export async function getJson<T>(url: string, init: Init = {}): Promise<T> {
  return (await send('GET', url, init)).json() as Promise<T>;
}

export async function postJson<T>(
  url: string,
  body: unknown = {},
  init: Init = {},
): Promise<T> {
  const merged: Init = {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  };
  return (await send('POST', url, merged, JSON.stringify(body))).json() as Promise<T>;
}

export async function put(
  url: string,
  body: BodyInit,
  contentType: string,
  init: Init = {},
): Promise<void> {
  const merged: Init = {
    ...init,
    headers: { 'content-type': contentType, ...(init.headers ?? {}) },
  };
  await send('PUT', url, merged, body);
}
