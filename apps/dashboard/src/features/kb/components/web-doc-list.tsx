import { m } from '#/paraglide/messages.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card';

import { useWebUrls } from '../hooks';
import type { WebDocumentSummary } from '../types';

export function WebDocList() {
  const docsQuery = useWebUrls();

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
        ) : (docsQuery.data?.documents ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{m.kb_web_list_empty()}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm font-mono">
            {(docsQuery.data?.documents ?? []).map((d: WebDocumentSummary) => (
              <li key={d.documentId} className="flex items-center gap-2">
                <code className="text-xs text-muted-foreground">{d.documentId.slice(0, 16)}…</code>
                {d.status ? <span className="text-xs">[{d.status}]</span> : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
