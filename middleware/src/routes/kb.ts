import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { KB_CONFIG } from '../config.js';
import { getIngestionJob, startIngestionJob } from '../utils/aws/bedrock/ingestion.js';
import { parseS3Uri, presignGetObject, presignPutObject } from '../utils/aws/s3/presign.js';

const UPLOAD_URL_TTL_SECONDS = 5 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

const router = Router();

if (!KB_CONFIG) {
  console.warn('[middleware] KB env not configured; /kb/* routes disabled');
} else {
  const { agentId, kbId, docsBucket, s3DataSourceId } = KB_CONFIG;
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
}

function sanitizeFilename(name: string): string | null {
  const base = name.replace(/^.*[\\/]/, '').trim();
  if (!base || base === '.' || base === '..') return null;
  if (/[ -]/.test(base)) return null;
  return base;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export default router;
