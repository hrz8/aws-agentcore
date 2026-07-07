import type { Scope } from '@repo/kit/identity';
import type { Logger } from '@repo/kit/logger';

import type { DocumentSummary } from '../domain/index.js';
import { KbNotFoundError, WebIngestRejectedError } from '../errors.js';
import type { KbRepository } from '../interface.js';

import { fetchPage } from '../crawler/fetch-page.js';
import { HostRateLimiter } from '../crawler/rate-limiter.js';
import { isAllowed } from '../crawler/robots.js';
import { discoverSitemap } from '../crawler/sitemap.js';

const DEFAULT_SITEMAP_MAX_URLS = 100;
const DEFAULT_SITEMAP_RATE_LIMIT_MS = 1_000;

export type WebIngestServiceOptions = {
  logger?: Logger;
  maxUrls?: number;
  rateLimitMs?: number;
};

export type IngestUrlResult = {
  ingested: number;
  document: DocumentSummary;
  sitemapFound: false;
};

export type CrawlSitemapResult =
  | (IngestUrlResult & { fallback: true })
  | {
      ingested: number;
      failed: number;
      sitemapFound: true;
      sitemapSource: string;
      truncated: boolean;
      failures: { url: string; error: string }[];
    };

export class WebIngestService {
  private readonly repo: KbRepository;
  private readonly log: Logger | undefined;
  private readonly maxUrls: number;
  private readonly rateLimitMs: number;

  constructor(repo: KbRepository, opts: WebIngestServiceOptions = {}) {
    this.repo = repo;
    this.log = opts.logger;
    this.maxUrls = opts.maxUrls ?? DEFAULT_SITEMAP_MAX_URLS;
    this.rateLimitMs = opts.rateLimitMs ?? DEFAULT_SITEMAP_RATE_LIMIT_MS;
  }

  async ingestUrl(scope: Scope, url: string): Promise<IngestUrlResult> {
    if (!(await isAllowed(url))) {
      throw new WebIngestRejectedError(url, 'blocked by robots.txt');
    }
    const page = await fetchPage(url);
    const doc = await this.repo.ingestWebDocument(scope, {
      text: page.text,
      contentHash: page.contentHash,
      sourceUrl: page.url,
      title: page.title,
      fetchedAt: page.fetchedAt,
    });
    return {
      ingested: 1,
      document: doc,
      sitemapFound: false as const,
    };
  }

  async refreshDocument(scope: Scope, docId: string): Promise<DocumentSummary> {
    const manifest = await this.repo.getWebManifest(scope, docId);
    if (!manifest) {
      throw new KbNotFoundError(`no manifest for docId ${docId}`);
    }
    if (!(await isAllowed(manifest.sourceUrl))) {
      throw new WebIngestRejectedError(manifest.sourceUrl, 'blocked by robots.txt');
    }
    const page = await fetchPage(manifest.sourceUrl);
    if (page.contentHash !== manifest.contentHash) {
      await this.repo.deleteWebDocument(scope, docId);
    }
    return this.repo.ingestWebDocument(scope, {
      text: page.text,
      contentHash: page.contentHash,
      sourceUrl: page.url,
      title: page.title,
      fetchedAt: page.fetchedAt,
    });
  }

  async crawlSitemap(scope: Scope, seedUrl: string): Promise<CrawlSitemapResult> {
    const { source, urls } = await discoverSitemap(seedUrl, this.maxUrls);
    if (urls.length === 0) {
      const single = await this.ingestUrl(scope, seedUrl);
      return { ...single, fallback: true as const };
    }
    const limiter = new HostRateLimiter(this.rateLimitMs);
    const ingested: DocumentSummary[] = [];
    const failed: { url: string; error: string }[] = [];
    for (const u of urls) {
      try {
        await limiter.acquire(u);
        if (!(await isAllowed(u))) {
          failed.push({ url: u, error: 'blocked by robots.txt' });
          continue;
        }
        const page = await fetchPage(u);
        const doc = await this.repo.ingestWebDocument(scope, {
          text: page.text,
          contentHash: page.contentHash,
          sourceUrl: page.url,
          title: page.title,
          fetchedAt: page.fetchedAt,
        });
        ingested.push(doc);
      } catch (err) {
        failed.push({ url: u, error: err instanceof Error ? err.message : String(err) });
      }
    }
    this.log?.info('kb.crawl-sitemap', {
      seedUrl,
      source: source ?? '',
      ingested: ingested.length,
      failed: failed.length,
      total: urls.length,
    });
    return {
      ingested: ingested.length,
      failed: failed.length,
      sitemapFound: true as const,
      sitemapSource: source ?? '',
      truncated: urls.length >= this.maxUrls,
      failures: failed,
    };
  }
}
