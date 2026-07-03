import { FileText, Loader2, RefreshCcw } from 'lucide-react';

import { m } from '#/paraglide/messages.js';
import { Button } from '#/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card';

import { useDocuments } from '../hooks';
import type { DocumentSummary } from '../types';

export function DocumentList() {
  const query = useDocuments();
  const docs = query.data?.documents ?? [];

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
        ) : docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{m.kb_docs_empty()}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {docs.map((d) => (
              <DocumentRow key={d.key} doc={d} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function DocumentRow({ doc }: { doc: DocumentSummary }) {
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
