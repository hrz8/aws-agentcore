import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { KB_CONFIG } from '../config.js';
import {
  deleteCustomDocument,
  getIngestionJob,
  ingestTextDocument,
  listCustomDocuments,
  startIngestionJob,
} from '../utils/aws/bedrock/ingestion.js';
import { parseS3Uri, presignGetObject, presignPutObject } from '../utils/aws/s3/presign.js';
import { HttpError } from '../utils/http/client.js';
import { EmptyContentError, fetchPage } from '../utils/web-crawler/fetch-page.js';
import { isAllowed } from '../utils/web-crawler/robots.js';
import { HostRateLimiter } from '../utils/web-crawler/rate-limiter.js';
import { discoverSitemap } from '../utils/web-crawler/sitemap.js';

const UPLOAD_URL_TTL_SECONDS = 5 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

const SITEMAP_MAX_URLS = 100;
const SITEMAP_RATE_LIMIT_MS = 1_000;

const router = Router();

if (!KB_CONFIG) {
  console.warn('[middleware] KB env not configured; /kb/* routes disabled');
} else {
  const { agentId, kbId, docsBucket, s3DataSourceId, webDataSourceId } = KB_CONFIG;
  const agentPrefix = `agents/${agentId}/`;

  const UploadBodySchema = z.object({
    filename: z.string().min(1).max(200),
    contentType: z.string().min(1).max(100).default('application/octet-stream'),
  });

  router.post('/kb/upload', async (req: Request, res: Response) => {
    const parsed = UploadBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid body', detail: z.treeifyError(parsed.error) });
      return;
    }
    const safeFilename = sanitizeFilename(parsed.data.filename);
    if (!safeFilename) {
      res.status(400).json({ error: 'invalid filename' });
      return;
    }

    const key = `${agentPrefix}${safeFilename}`;
    const sidecarKey = `${key}.metadata.json`;

    const [fileUploadUrl, sidecarUploadUrl] = await Promise.all([
      presignPutObject(docsBucket, key, parsed.data.contentType, UPLOAD_URL_TTL_SECONDS),
      presignPutObject(docsBucket, sidecarKey, 'application/json', UPLOAD_URL_TTL_SECONDS),
    ]);

    res.json({
      key,
      sidecarKey,
      fileUploadUrl,
      sidecarUploadUrl,
      sidecarBody: { metadataAttributes: { agent_id: agentId } },
      expiresIn: UPLOAD_URL_TTL_SECONDS,
    });
  });

  router.post('/kb/sync', async (_req, res) => {
    try {
      const job = await startIngestionJob(kbId, s3DataSourceId);
      res.json(job);
    } catch (err) {
      res.status(502).json({ error: 'start ingestion failed', detail: errMsg(err) });
    }
  });

  router.get('/kb/jobs/:id', async (req, res) => {
    const id = req.params.id;
    if (!id) { res.status(400).json({ error: 'missing id' }); return; }
    try {
      const job = await getIngestionJob(kbId, s3DataSourceId, id);
      res.json(job);
    } catch (err) {
      res.status(502).json({ error: 'get ingestion failed', detail: errMsg(err) });
    }
  });

  const SignQuerySchema = z.object({
    uri: z.string().startsWith('s3://'),
    page: z.coerce.number().int().positive().optional(),
  });

  router.get('/kb/sign', async (req, res) => {
    const parsed = SignQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid query', detail: z.treeifyError(parsed.error) });
      return;
    }
    const allowedPrefix = `s3://${docsBucket}/${agentPrefix}`;
    if (!parsed.data.uri.startsWith(allowedPrefix)) {
      res.status(403).json({ error: 'uri not in this agent\'s scope', allowedPrefix });
      return;
    }
    const { bucket, key } = parseS3Uri(parsed.data.uri);
    const url = await presignGetObject(bucket, key, DOWNLOAD_URL_TTL_SECONDS, 'inline');
    const withFragment = parsed.data.page ? `${url}#page=${parsed.data.page}` : url;
    res.json({ url: withFragment, expiresIn: DOWNLOAD_URL_TTL_SECONDS });
  });

  const WebUrlsPostSchema = z.object({
    url: z.url(),
    sitemap: z.boolean().optional().default(false),
  });

  router.post('/kb/web/urls', async (req, res) => {
    if (!webDataSourceId) {
      res.status(409).json({ error: 'web data source not configured' });
      return;
    }
    const parsed = WebUrlsPostSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid body', detail: z.treeifyError(parsed.error) });
      return;
    }

    const { url, sitemap } = parsed.data;

    if (sitemap) {
      try {
        const result = await crawlSitemap(url, webDataSourceId);
        res.json(result);
      } catch (err) {
        res.status(502).json({ error: 'sitemap crawl failed', detail: errMsg(err) });
      }
      return;
    }

    try {
      const doc = await ingestSingleUrl(url, webDataSourceId);
      res.json({ ingested: 1, document: doc, sitemapFound: false });
    } catch (err) {
      res.status(mapIngestStatus(err)).json({ error: 'ingest failed', detail: errMsg(err) });
    }
  });

  router.get('/kb/web/urls', async (_req, res) => {
    if (!webDataSourceId) {
      res.status(409).json({ error: 'web data source not configured' });
      return;
    }
    try {
      const docs = await listCustomDocuments(kbId, webDataSourceId);
      res.json({ documents: docs });
    } catch (err) {
      res.status(502).json({ error: 'list failed', detail: errMsg(err) });
    }
  });

  router.delete('/kb/web/urls/:docId', async (req, res) => {
    if (!webDataSourceId) {
      res.status(409).json({ error: 'web data source not configured' });
      return;
    }
    const docId = req.params.docId;
    if (!docId) { res.status(400).json({ error: 'missing docId' }); return; }
    try {
      const result = await deleteCustomDocument(kbId, webDataSourceId, docId);
      res.json(result);
    } catch (err) {
      res.status(502).json({ error: 'delete failed', detail: errMsg(err) });
    }
  });

  async function ingestSingleUrl(url: string, wDsId: string) {
    if (!(await isAllowed(url))) {
      throw new HttpError(url, 'http', 403, 'blocked by robots.txt');
    }
    const page = await fetchPage(url);
    return ingestTextDocument({
      knowledgeBaseId: kbId,
      dataSourceId: wDsId,
      documentId: page.contentHash,
      text: page.text,
      metadata: {
        agent_id: agentId,
        source_url: page.url,
        title: page.title,
        fetched_at: page.fetchedAt,
      },
    });
  }

  async function crawlSitemap(seedUrl: string, wDsId: string) {
    const { source, urls } = await discoverSitemap(seedUrl, SITEMAP_MAX_URLS);

    if (urls.length === 0) {
      const doc = await ingestSingleUrl(seedUrl, wDsId);
      return { ingested: 1, document: doc, sitemapFound: false, fallback: true };
    }

    const limiter = new HostRateLimiter(SITEMAP_RATE_LIMIT_MS);
    const ingested: unknown[] = [];
    const failed: { url: string; error: string }[] = [];
    for (const u of urls) {
      try {
        await limiter.acquire(u);
        if (!(await isAllowed(u))) {
          failed.push({ url: u, error: 'blocked by robots.txt' });
          continue;
        }
        const page = await fetchPage(u);
        const doc = await ingestTextDocument({
          knowledgeBaseId: kbId,
          dataSourceId: wDsId,
          documentId: page.contentHash,
          text: page.text,
          metadata: {
            agent_id: agentId,
            source_url: page.url,
            title: page.title,
            fetched_at: page.fetchedAt,
          },
        });
        ingested.push(doc);
      } catch (err) {
        failed.push({ url: u, error: errMsg(err) });
      }
    }
    return {
      ingested: ingested.length,
      failed: failed.length,
      sitemapFound: true,
      sitemapSource: source,
      truncated: urls.length >= SITEMAP_MAX_URLS,
      failures: failed,
    };
  }
}

function sanitizeFilename(name: string): string | null {
  const base = name.replace(/^.*[\\/]/, '').trim();
  if (!base || base === '.' || base === '..') return null;
  if (/[ -]/.test(base)) return null;
  return base;
}

function mapIngestStatus(err: unknown): number {
  if (err instanceof EmptyContentError) return 422;
  if (err instanceof HttpError) {
    if (err.kind === 'http' && err.status === 403) return 403;
    if (err.kind === 'http' && err.status === 404) return 404;
    if (err.kind === 'timeout') return 504;
  }
  return 502;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export default router;
