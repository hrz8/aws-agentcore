import { getJson, postJson, put } from './http';

const MIDDLEWARE_URL =
  import.meta.env.VITE_MIDDLEWARE_URL ?? 'http://localhost:7890';

export type UploadPresignResponse = {
  key: string;
  sidecarKey: string;
  fileUploadUrl: string;
  sidecarUploadUrl: string;
  sidecarBody: { metadataAttributes: Record<string, string> };
  expiresIn: number;
};

export type IngestionJobStatus =
  | 'STARTING' | 'IN_PROGRESS' | 'COMPLETE' | 'FAILED' | 'STOPPING' | 'STOPPED';

export type IngestionJobInfo = {
  status: IngestionJobStatus;
  statistics?: Record<string, number>;
  failureReasons?: string[];
};

export function presignUpload(
  filename: string,
  contentType: string,
): Promise<UploadPresignResponse> {
  return postJson(`${MIDDLEWARE_URL}/kb/upload`, { filename, contentType });
}

export function putToS3(url: string, body: Blob | string, contentType: string): Promise<void> {
  return put(url, body, contentType);
}

export function startIngestion(): Promise<{ ingestionJobId: string; status: string }> {
  return postJson(`${MIDDLEWARE_URL}/kb/sync`);
}

export function getIngestionJob(id: string): Promise<IngestionJobInfo> {
  return getJson(`${MIDDLEWARE_URL}/kb/jobs/${encodeURIComponent(id)}`);
}

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 5 * 60_000;

export async function pollIngestion(
  jobId: string,
  onUpdate?: (s: IngestionJobStatus) => void,
): Promise<IngestionJobStatus> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  for (;;) {
    if (Date.now() > deadline) throw new Error('ingestion poll timed out');
    const info = await getIngestionJob(jobId);
    onUpdate?.(info.status);
    if (info.status === 'COMPLETE' || info.status === 'FAILED' || info.status === 'STOPPED') {
      return info.status;
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
}

export async function presignCitation(uri: string, page?: number | null): Promise<string> {
  const params = new URLSearchParams({ uri });
  if (page) params.set('page', String(page));
  const body = await getJson<{ url: string }>(`${MIDDLEWARE_URL}/kb/sign?${params}`);
  return body.url;
}

export type WebDocumentStatus = 'PENDING' | 'INDEXED' | 'FAILED' | 'IN_PROGRESS' | 'DELETING';

export type WebDocumentSummary = {
  documentId: string;
  status?: WebDocumentStatus;
  statusReason?: string;
  updatedAt?: string;
};

export type AddWebUrlResult =
  | { ingested: number; document: WebDocumentSummary; sitemapFound: false; fallback?: true }
  | {
      ingested: number;
      failed: number;
      sitemapFound: true;
      sitemapSource: string | null;
      truncated: boolean;
      failures: { url: string; error: string }[];
    };

export function addWebUrl(url: string, sitemap = false): Promise<AddWebUrlResult> {
  return postJson(`${MIDDLEWARE_URL}/kb/web/urls`, { url, sitemap });
}

export function listWebUrls(): Promise<{ documents: WebDocumentSummary[] }> {
  return getJson(`${MIDDLEWARE_URL}/kb/web/urls`);
}
