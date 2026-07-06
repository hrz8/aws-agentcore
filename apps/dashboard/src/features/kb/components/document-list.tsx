import { useQueryClient } from '@tanstack/react-query';
import { useBlocker } from '@tanstack/react-router';
import { FileText, Loader2, RefreshCcw, Trash2 } from 'lucide-react';
import * as React from 'react';

import { useCurrentScope } from '#/features/agents';
import { m } from '#/paraglide/messages.js';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog';
import { Button } from '#/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card';
import { cn } from '#/shared/utils';

import { pollIngestion, useDeleteDocument, useDocuments } from '../hooks';
import { kbQueries } from '../queries';
import { IngestionJobStatus, type DocumentSummary } from '../types';

type DeleteState = {
  key: string;
  filename: string;
  jobStatus?: IngestionJobStatus;
  error?: string;
};

export function DocumentList() {
  const query = useDocuments();
  const docs = query.data?.documents ?? [];
  const scope = useCurrentScope();
  const qc = useQueryClient();
  const deleteMutation = useDeleteDocument();
  const [deleting, setDeleting] = React.useState<DeleteState | null>(null);

  const busy = deleting !== null && !deleting.error;

  useBlocker({
    shouldBlockFn: () => {
      if (!busy) return false;
      return !window.confirm(m.kb_delete_leave_confirm());
    },
    enableBeforeUnload: () => busy,
  });

  async function handleConfirmDelete(doc: DocumentSummary) {
    if (!scope) return;
    setDeleting({ key: doc.key, filename: doc.filename });
    try {
      const res = await deleteMutation.mutateAsync({ key: doc.key });
      const jobId = res.ingestionJob.ingestionJobId;
      if (!jobId) {
        throw new Error('re-sync started with no ingestion job id');
      }
      setDeleting((prev) =>
        prev ? { ...prev, jobStatus: IngestionJobStatus.Starting } : prev,
      );
      const final = await pollIngestion(scope, jobId, (s) =>
        setDeleting((prev) => (prev ? { ...prev, jobStatus: s } : prev)),
      );
      qc.invalidateQueries({ queryKey: kbQueries.all });
      if (final === IngestionJobStatus.Complete) {
        setDeleting(null);
      } else {
        setDeleting((prev) =>
          prev ? { ...prev, error: `re-sync ${final}` } : prev,
        );
      }
    } catch (err) {
      setDeleting((prev) =>
        prev
          ? { ...prev, error: err instanceof Error ? err.message : String(err) }
          : prev,
      );
    }
  }

  const optimisticallyHiddenKey = busy ? deleting?.key : undefined;
  const visibleDocs = docs.filter((d) => d.key !== optimisticallyHiddenKey);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>{m.kb_docs_title()}</CardTitle>
            <CardDescription>{m.kb_docs_body()}</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            {query.isFetching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            {m.common_refresh()}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">{m.common_loading()}</p>
        ) : query.error ? (
          <p className="text-sm text-destructive">{(query.error as Error).message}</p>
        ) : visibleDocs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{m.kb_docs_empty()}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {visibleDocs.map((d) => (
              <DocumentRow
                key={d.key}
                doc={d}
                disabled={busy}
                onDelete={handleConfirmDelete}
              />
            ))}
          </ul>
        )}
        {deleting ? (
          <div
            className={cn(
              'mt-3 flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
              deleting.error
                ? 'border-destructive/30 bg-destructive/5 text-destructive'
                : 'border-primary/30 bg-primary/5 text-primary',
            )}
          >
            {deleting.error ? (
              <span className="min-w-0 break-words">
                {m.kb_docs_delete_status_failed({ message: deleting.error })}
              </span>
            ) : (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                <span className="min-w-0 break-words">
                  {m.kb_docs_delete_status_resyncing({
                    filename: deleting.filename,
                    status: deleting.jobStatus ?? IngestionJobStatus.Starting,
                  })}
                </span>
              </>
            )}
            {deleting.error ? (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={() => setDeleting(null)}
              >
                {m.common_close()}
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DocumentRow({
  doc,
  disabled,
  onDelete,
}: {
  doc: DocumentSummary;
  disabled: boolean;
  onDelete: (doc: DocumentSummary) => void;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col">
        <code className="truncate text-sm">{doc.filename}</code>
        <span className="text-xs text-muted-foreground">
          {formatBytes(doc.size)}
          {doc.lastModified ? <> · {formatRelative(doc.lastModified)}</> : null}
        </span>
      </div>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-label={m.kb_docs_delete_action()}
          onClick={() => setOpen(true)}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.kb_docs_delete_title()}</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="mb-2 block font-mono text-xs text-foreground/80">
                {doc.filename}
              </span>
              {m.kb_docs_delete_body()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.common_cancel()}</AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                'bg-destructive text-destructive-foreground hover:bg-destructive/90',
              )}
              onClick={() => onDelete(doc)}
            >
              {m.kb_docs_delete_action()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

const UNITS = ['B', 'KB', 'MB', 'GB'] as const;
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return m.kb_docs_size_unknown();
  }
  let n = bytes;
  let u = 0;
  while (n >= 1024 && u < UNITS.length - 1) {
    n /= 1024;
    u += 1;
  }
  return `${n < 10 && u > 0 ? n.toFixed(1) : Math.round(n)} ${UNITS[u]}`;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return iso;
  }
  const diff = Date.now() - then;
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) {
    return m.kb_docs_time_just_now();
  }
  if (diff < hr) {
    return m.kb_docs_time_minutes_ago({ n: Math.floor(diff / min).toString() });
  }
  if (diff < day) {
    return m.kb_docs_time_hours_ago({ n: Math.floor(diff / hr).toString() });
  }
  return m.kb_docs_time_days_ago({ n: Math.floor(diff / day).toString() });
}
