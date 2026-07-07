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
  deleteDocumentServerFn,
  deleteWebUrlServerFn,
  kbJobServerFn,
  presignUploadServerFn,
  refreshWebUrlServerFn,
  startIngestionServerFn,
} from './server-fns';
import { IngestionJobStatus, KbDocStatus } from './types';

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

const WEB_URLS_POLL_MS = 3_000;
export const WEB_DOC_PENDING_STATUSES = new Set<string>([
  KbDocStatus.Pending,
  KbDocStatus.Starting,
  KbDocStatus.InProgress,
  KbDocStatus.Deleting,
  KbDocStatus.DeleteInProgress,
]);

export function useWebUrls() {
  const scope = useCurrentScope();
  return useQuery({
    ...kbQueries.webUrls(scope ?? EMPTY_SCOPE),
    enabled: !!scope,
    refetchInterval: (query) => {
      const docs = query.state.data?.documents ?? [];
      const pending = docs.some(
        (d) => d.status !== undefined && WEB_DOC_PENDING_STATUSES.has(d.status),
      );
      return pending ? WEB_URLS_POLL_MS : false;
    },
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

export function useDeleteDocument() {
  const scope = useCurrentScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { key: string }) =>
      callServerFn(deleteDocumentServerFn, {
        scope: toWireScope(requireScope(scope)),
        key: input.key,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: kbQueries.all }),
  });
}

export function useDeleteWebUrl() {
  const scope = useCurrentScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { docId: string }) =>
      callServerFn(deleteWebUrlServerFn, {
        scope: toWireScope(requireScope(scope)),
        docId: input.docId,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: kbQueries.all }),
  });
}

export function useRefreshWebUrl() {
  const scope = useCurrentScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { docId: string }) =>
      callServerFn(refreshWebUrlServerFn, {
        scope: toWireScope(requireScope(scope)),
        docId: input.docId,
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
