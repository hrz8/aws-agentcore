import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useCurrentScope } from '#/features/agents';
import { callServerFn } from '#/shared/server-fn/envelope';
import {
  requireScope,
  toWireScope,
  type ResolvedScope,
} from '#/shared/scope';

import { kbQueries } from './queries';
import {
  addWebUrlServerFn,
  kbJobServerFn,
  presignUploadServerFn,
  startIngestionServerFn,
} from './server-fns';
import { IngestionJobStatus } from './types';

const EMPTY_SCOPE: ResolvedScope = {
  tenantId: '',
  tenantSlug: '',
  agentId: '',
  agentVersion: '',
};

export function useDocuments() {
  const scope = useCurrentScope();
  return useQuery({
    ...kbQueries.documents(scope ?? EMPTY_SCOPE),
    enabled: !!scope,
  });
}

export function useWebUrls() {
  const scope = useCurrentScope();
  return useQuery({
    ...kbQueries.webUrls(scope ?? EMPTY_SCOPE),
    enabled: !!scope,
  });
}

export function usePresignUpload() {
  const scope = useCurrentScope();
  return useMutation({
    mutationFn: (input: { filename: string; contentType: string }) =>
      callServerFn(presignUploadServerFn, {
        scope: toWireScope(requireScope(scope)),
        ...input,
      }),
  });
}

export function useStartIngestion() {
  const scope = useCurrentScope();
  return useMutation({
    mutationFn: () =>
      callServerFn(startIngestionServerFn, {
        scope: toWireScope(requireScope(scope)),
      }),
  });
}

export function useAddWebUrl() {
  const scope = useCurrentScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { url: string; sitemap: boolean }) =>
      callServerFn(addWebUrlServerFn, {
        scope: toWireScope(requireScope(scope)),
        ...input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: kbQueries.all }),
  });
}

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 5 * 60_000;

export async function pollIngestion(
  scope: ResolvedScope,
  jobId: string,
  onUpdate?: (s: IngestionJobStatus) => void,
): Promise<IngestionJobStatus> {
  const wireScope = toWireScope(scope);
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  for (;;) {
    if (Date.now() > deadline) throw new Error('ingestion poll timed out');
    const info = await callServerFn(kbJobServerFn, { scope: wireScope, id: jobId });
    const status = (info.status ?? IngestionJobStatus.Starting) as IngestionJobStatus;
    onUpdate?.(status);
    if (
      status === IngestionJobStatus.Complete
      || status === IngestionJobStatus.Failed
      || status === IngestionJobStatus.Stopped
    ) return status;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

export function putToS3(url: string, body: Blob | string, contentType: string): Promise<void> {
  return fetch(url, {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body,
  }).then((res) => {
    if (!res.ok) {
      throw new Error(`PUT s3 → ${res.status}`);
    }
  });
}
