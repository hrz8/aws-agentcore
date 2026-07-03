import { XMLParser } from 'fast-xml-parser';
import { gunzipSync } from 'node:zlib';

import { safeHttpGetBytes } from '@repo/kit/http.server';

import { sitemapUrls } from './robots.js';

const DEFAULT_SITEMAP_PATHS = ['/sitemap.xml', '/sitemap_index.xml'];
const MAX_DEPTH = 3;
const SITEMAP_MAX_BYTES = 5 * 1024 * 1024;
// Cap decompressed size to guard against gzip bombs.
const SITEMAP_MAX_DECOMPRESSED_BYTES = 20 * 1024 * 1024;

const parser = new XMLParser({
  ignoreAttributes: true,
  processEntities: true,
});

export type SitemapResult = {
  source: string | null;
  urls: string[];
};

export async function discoverSitemap(targetUrl: string, maxUrls: number): Promise<SitemapResult> {
  const u = new URL(targetUrl);
  const candidates = [
    ...(await sitemapUrls(targetUrl)),
    ...DEFAULT_SITEMAP_PATHS.map((p) => `${u.origin}${p}`),
  ];
  for (const candidate of candidates) {
    try {
      const urls = await fetchAndExpand(candidate, u.hostname, 0, maxUrls);
      if (urls.length > 0) {
        return { source: candidate, urls };
      }
    } catch { /* try next candidate */ }
  }
  return { source: null, urls: [] };
}

async function fetchAndExpand(
  sitemapUrl: string,
  seedHostname: string,
  depth: number,
  maxUrls: number,
): Promise<string[]> {
  if (depth > MAX_DEPTH) {
    return [];
  }
  const buf = await safeHttpGetBytes(sitemapUrl, {
    timeoutMs: 10_000,
    maxBytes: SITEMAP_MAX_BYTES,
  });
  const decoded = Buffer.from(buf);
  let xml: string;
  if (sitemapUrl.endsWith('.gz')) {
    const inflated = gunzipSync(decoded);
    if (inflated.length > SITEMAP_MAX_DECOMPRESSED_BYTES) {
      throw new Error(
        `sitemap ${sitemapUrl} decompressed to ${inflated.length} bytes, cap ${SITEMAP_MAX_DECOMPRESSED_BYTES}`,
      );
    }
    xml = inflated.toString('utf8');
  } else {
    xml = decoded.toString('utf8');
  }

  const parsed = parser.parse(xml);
  if (parsed.sitemapindex?.sitemap) {
    const children = asArray(parsed.sitemapindex.sitemap)
      .map((s: { loc?: string }) => s.loc)
      .filter((u): u is string => typeof u === 'string')
      .filter((u) => isSameHost(u, seedHostname));
    const out: string[] = [];
    for (const child of children) {
      if (out.length >= maxUrls) {
        break;
      }
      const more = await fetchAndExpand(child, seedHostname, depth + 1, maxUrls - out.length);
      out.push(...more);
    }
    return out.slice(0, maxUrls);
  }
  if (parsed.urlset?.url) {
    return asArray(parsed.urlset.url)
      .map((u: { loc?: string }) => u.loc)
      .filter((u): u is string => typeof u === 'string')
      .filter((u) => isSameHost(u, seedHostname))
      .slice(0, maxUrls);
  }
  return [];
}

function isSameHost(candidateUrl: string, seedHostname: string): boolean {
  try {
    const host = new URL(candidateUrl).hostname;
    return host === seedHostname || host.endsWith(`.${seedHostname}`);
  } catch {
    return false;
  }
}

function asArray<T>(v: T | T[]): T[] {
  return Array.isArray(v) ? v : [v];
}
