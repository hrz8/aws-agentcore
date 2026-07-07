import { useBlocker } from '@tanstack/react-router';
import { ExternalLink, Globe, RefreshCcw, Trash2 } from 'lucide-react';
import * as React from 'react';

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

import {
  useDeleteWebUrl,
  useRefreshWebUrl,
  useWebUrls,
  WEB_DOC_PENDING_STATUSES,
} from '../hooks';
import { IngestionJobStatus, type WebDocumentSummary } from '../types';

const STATUS_TONE: Record<string, string> = {
  [IngestionJobStatus.Complete]: 'border-primary/30 bg-primary/5 text-primary',
  [IngestionJobStatus.Failed]: 'border-destructive/30 bg-destructive/5 text-destructive',
  [IngestionJobStatus.Starting]: 'border-muted-foreground/30 bg-muted text-muted-foreground',
  [IngestionJobStatus.InProgress]: 'border-muted-foreground/30 bg-muted text-muted-foreground',
  [IngestionJobStatus.Stopping]: 'border-muted-foreground/30 bg-muted text-muted-foreground',
  [IngestionJobStatus.Stopped]: 'border-muted-foreground/30 bg-muted text-muted-foreground',
};

export function WebDocList() {
  const docsQuery = useWebUrls();
  const deleteMutation = useDeleteWebUrl();
  const refreshMutation = useRefreshWebUrl();
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);
  const [refreshingId, setRefreshingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshError, setRefreshError] = React.useState<string | null>(null);

  const docs = docsQuery.data?.documents ?? [];
  const hasPending = docs.some(
    (d: WebDocumentSummary) => d.status !== undefined && WEB_DOC_PENDING_STATUSES.has(d.status),
  );
  const busy =
    deleteMutation.isPending || refreshMutation.isPending || hasPending;

  useBlocker({
    shouldBlockFn: () => {
      if (!busy) return false;
      return !window.confirm(m.kb_web_leave_confirm());
    },
    enableBeforeUnload: () => busy,
  });

  async function handleDelete(doc: WebDocumentSummary) {
    setError(null);
    setPendingDeleteId(doc.documentId);
    try {
      await deleteMutation.mutateAsync({ docId: doc.documentId });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPendingDeleteId(null);
    }
  }

  async function handleRefresh(doc: WebDocumentSummary) {
    setRefreshError(null);
    setRefreshingId(doc.documentId);
    try {
      await refreshMutation.mutateAsync({ docId: doc.documentId });
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshingId(null);
    }
  }

  const visibleDocs = docs.filter((d) => d.documentId !== pendingDeleteId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.kb_web_list_title()}</CardTitle>
        <CardDescription>{m.kb_web_list_body()}</CardDescription>
      </CardHeader>
      <CardContent>
        {docsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{m.common_loading()}</p>
        ) : docsQuery.error ? (
          <p className="text-sm text-destructive">{(docsQuery.error as Error).message}</p>
        ) : visibleDocs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{m.kb_web_list_empty()}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {visibleDocs.map((d) => (
              <WebDocRow
                key={d.documentId}
                doc={d}
                disabled={busy}
                refreshing={refreshingId === d.documentId}
                onDelete={handleDelete}
                onRefresh={handleRefresh}
              />
            ))}
          </ul>
        )}
        {error ? (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <span className="min-w-0 break-words">
              {m.kb_web_delete_status_failed({ message: error })}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => setError(null)}
            >
              {m.common_close()}
            </Button>
          </div>
        ) : null}
        {refreshError ? (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <span className="min-w-0 break-words">
              {m.kb_web_refresh_status_failed({ message: refreshError })}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => setRefreshError(null)}
            >
              {m.common_close()}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function WebDocRow({
  doc,
  disabled,
  refreshing,
  onDelete,
  onRefresh,
}: {
  doc: WebDocumentSummary;
  disabled: boolean;
  refreshing: boolean;
  onDelete: (doc: WebDocumentSummary) => void;
  onRefresh: (doc: WebDocumentSummary) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [refreshOpen, setRefreshOpen] = React.useState(false);
  const status = doc.status;
  const statusTone = status ? STATUS_TONE[status] : undefined;

  const title = doc.title?.trim() ? doc.title : m.kb_web_untitled();
  const displayUrl = doc.sourceUrl ?? shortenId(doc.documentId);
  const canRefresh = Boolean(doc.sourceUrl);

  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{title}</span>
        {doc.sourceUrl ? (
          <a
            href={doc.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            <span className="truncate">{displayUrl}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : (
          <code className="truncate text-xs text-muted-foreground">{displayUrl}</code>
        )}
      </div>
      {status ? (
        <span
          className={cn(
            'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
            statusTone ?? 'border-muted-foreground/30 bg-muted text-muted-foreground',
          )}
        >
          {status}
        </span>
      ) : null}
      <AlertDialog open={refreshOpen} onOpenChange={setRefreshOpen}>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled || !canRefresh}
          aria-label={m.kb_web_refresh_action()}
          title={m.kb_web_refresh_action()}
          onClick={() => setRefreshOpen(true)}
          className="text-muted-foreground hover:text-foreground"
        >
          <RefreshCcw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        </Button>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.kb_web_refresh_title()}</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="mb-2 block truncate font-mono text-xs text-foreground/80">
                {displayUrl}
              </span>
              {m.kb_web_refresh_body()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.common_cancel()}</AlertDialogCancel>
            <AlertDialogAction onClick={() => onRefresh(doc)}>
              {m.kb_web_refresh_action()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-label={m.kb_web_delete_action()}
          onClick={() => setOpen(true)}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.kb_web_delete_title()}</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="mb-2 block truncate font-mono text-xs text-foreground/80">
                {displayUrl}
              </span>
              {m.kb_web_delete_body()}
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
              {m.kb_web_delete_action()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

function shortenId(id: string): string {
  return `${id.slice(0, 16)}…`;
}
