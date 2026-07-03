import { lookup } from 'node:dns/promises';
import net from 'node:net';

import { HttpError, type HttpOptions, DEFAULT_USER_AGENT } from './http.js';

const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export type SafeHttpOptions = HttpOptions & {
  maxBytes?: number;
  maxRedirects?: number;
};

function isPrivateIp(addr: string): boolean {
  const v = net.isIP(addr);
  if (v === 4) return isPrivateIPv4(addr);
  if (v === 6) return isPrivateIPv6(addr);
  return true;
}

function isPrivateIPv4(addr: string): boolean {
  const parts = addr.split('.').map((x) => Number.parseInt(x, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && (b === 0 || b === 168)) return true;
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return true;
  if (a === 203 && b === 113) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIPv6(addr: string): boolean {
  const lower = addr.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]!);
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true;
  if (lower.startsWith('ff')) return true;
  return false;
}

async function assertPublicHost(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new HttpError(url, 'connection', null, 'invalid URL');
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new HttpError(url, 'connection', null, `protocol not allowed: ${parsed.protocol}`);
  }
  const host = parsed.hostname;
  if (net.isIP(host)) {
    if (isPrivateIp(host)) {
      throw new HttpError(url, 'connection', null, `blocked private IP: ${host}`);
    }
    return;
  }
  const addrs = await lookup(host, { all: true }).catch(() => {
    throw new HttpError(url, 'connection', null, `DNS lookup failed for ${host}`);
  });
  for (const a of addrs) {
    if (isPrivateIp(a.address)) {
      throw new HttpError(
        url,
        'connection',
        null,
        `blocked private IP for ${host}: ${a.address}`,
      );
    }
  }
}

async function readBodyCapped(url: string, res: Response, maxBytes: number): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array();
  const clHeader = res.headers.get('content-length');
  if (clHeader) {
    const cl = Number.parseInt(clHeader, 10);
    if (Number.isFinite(cl) && cl > maxBytes) {
      throw new HttpError(url, 'http', res.status, `response ${cl} bytes exceeds cap ${maxBytes}`);
    }
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new HttpError(url, 'http', res.status, `response exceeds cap ${maxBytes} bytes`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function safeCrawlFetch(url: string, opts: SafeHttpOptions = {}): Promise<{
  res: Response;
  bytes: Uint8Array;
  finalUrl: string;
}> {
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const signal = opts.signal ?? AbortSignal.timeout(timeoutMs);
  let current = url;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    await assertPublicHost(current);
    let res: Response;
    try {
      res = await fetch(current, {
        method: 'GET',
        headers: {
          'user-agent': opts.userAgent ?? DEFAULT_USER_AGENT,
          ...(opts.headers ?? {}),
        },
        redirect: 'manual',
        signal,
      });
    } catch (err) {
      if (err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
        throw new HttpError(current, 'timeout', null, `timed out after ${timeoutMs}ms`);
      }
      throw new HttpError(
        current,
        'connection',
        null,
        err instanceof Error ? err.message : String(err),
      );
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      await res.body?.cancel().catch(() => undefined);
      if (!location) {
        throw new HttpError(current, 'http', res.status, 'redirect without Location header');
      }
      current = new URL(location, current).toString();
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined);
      throw new HttpError(current, 'http', res.status);
    }
    const bytes = await readBodyCapped(current, res, maxBytes);
    return { res, bytes, finalUrl: current };
  }
  throw new HttpError(url, 'http', null, `too many redirects (>${maxRedirects})`);
}

export async function safeHttpGetText(url: string, opts?: SafeHttpOptions): Promise<string> {
  const { bytes } = await safeCrawlFetch(url, opts);
  return new TextDecoder('utf-8').decode(bytes);
}

export async function safeHttpGetBytes(url: string, opts?: SafeHttpOptions): Promise<Uint8Array> {
  const { bytes } = await safeCrawlFetch(url, opts);
  return bytes;
}
