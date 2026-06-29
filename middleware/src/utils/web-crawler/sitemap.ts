import { XMLParser } from 'fast-xml-parser';
import { gunzipSync } from 'node:zlib';

import { httpGetBytes } from '../http/client.js';
import { sitemapUrls } from './robots.js';

const DEFAULT_SITEMAP_PATHS = ['/sitemap.xml', '/sitemap_index.xml'];
const MAX_DEPTH = 3;

const parser = new XMLParser({ ignoreAttributes: true });

export type SitemapResult = {
  source: string | null;
  urls: string[];
};

export async function discoverSitemap(targetUrl: string, maxUrls: number): Promise<SitemapResult> {
  const u = new URL(targetUrl);
  const candidates = [
    ...await sitemapUrls(targetUrl),
    ...DEFAULT_SITEMAP_PATHS.map(p => `${u.origin}${p}`),
  ];

  for (const candidate of candidates) {
    try {
      const urls = await fetchAndExpand(candidate, 0, maxUrls);
      if (urls.length > 0) return { source: candidate, urls };
    } catch {
      // Try next candidate.
    }
  }
  return { source: null, urls: [] };
}

async function fetchAndExpand(sitemapUrl: string, depth: number, maxUrls: number): Promise<string[]> {
  if (depth > MAX_DEPTH) return [];
  const buf = await httpGetBytes(sitemapUrl, { timeoutMs: 10_000 });
  const decoded = Buffer.from(buf);
  const xml = sitemapUrl.endsWith('.gz')
    ? gunzipSync(decoded).toString('utf8')
    : decoded.toString('utf8');

  const parsed = parser.parse(xml);
  if (parsed.sitemapindex?.sitemap) {
    const children = asArray(parsed.sitemapindex.sitemap)
      .map((s: { loc?: string }) => s.loc)
      .filter((u): u is string => typeof u === 'string');
    const out: string[] = [];
    for (const child of children) {
      if (out.length >= maxUrls) break;
      const more = await fetchAndExpand(child, depth + 1, maxUrls - out.length);
      out.push(...more);
    }
    return out.slice(0, maxUrls);
  }
  if (parsed.urlset?.url) {
    return asArray(parsed.urlset.url)
      .map((u: { loc?: string }) => u.loc)
      .filter((u): u is string => typeof u === 'string')
      .slice(0, maxUrls);
  }
  return [];
}

function asArray<T>(v: T | T[]): T[] {
  return Array.isArray(v) ? v : [v];
}
