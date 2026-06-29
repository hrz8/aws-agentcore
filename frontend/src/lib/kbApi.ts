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

export async function presignCitation(uri: string, page?: number | null): Promise<string> {
  const params = new URLSearchParams({ uri });
  if (page) params.set('page', String(page));
  const body = await getJson<{ url: string }>(`${MIDDLEWARE_URL}/kb/sign?${params}`);
  return body.url;
}
