import { useEffect, useState } from 'react';

import {
  addWebUrl,
  listWebUrls,
  type AddWebUrlResult,
  type WebDocumentSummary,
} from '../lib/kbApi';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'adding'; url: string; sitemap: boolean }
  | { kind: 'ok'; message: string }
  | { kind: 'error'; message: string };

export function WebUrls(): React.ReactElement {
  const [docs, setDocs] = useState<WebDocumentSummary[]>([]);
  const [input, setInput] = useState('');
  const [useSitemap, setUseSitemap] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    listWebUrls()
      .then(res => {
        if (cancelled) return;
        setDocs(res.documents);
        setStatus({ kind: 'idle' });
      })
      .catch(err => {
        if (cancelled) return;
        setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
      });
    return () => { cancelled = true; };
  }, []);

  const busy = status.kind === 'adding' || status.kind === 'loading';

  async function onAdd(): Promise<void> {
    const url = input.trim();
    if (!url) return;
    setStatus({ kind: 'adding', url, sitemap: useSitemap });
    try {
      const result = await addWebUrl(url, useSitemap);
      setInput('');
      try {
        const res = await listWebUrls();
        setDocs(res.documents);
      } catch { /* list refresh is best-effort */ }
      setStatus({ kind: 'ok', message: summarize(result) });
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <div className="weburls">
      <div className="weburls__row">
        <input
          type="url"
          placeholder="https://example.com/docs/"
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={busy}
          onKeyDown={e => e.key === 'Enter' && onAdd()}
        />
        <label className="weburls__sitemap">
          <input
            type="checkbox"
            checked={useSitemap}
            onChange={e => setUseSitemap(e.target.checked)}
            disabled={busy}
          />
          {' '}also index sitemap
        </label>
        <button type="button" onClick={onAdd} disabled={busy || !input.trim()}>
          crawl url
        </button>
      </div>
      {docs.length > 0 && (
        <details className="weburls__details">
          <summary>{docs.length} indexed document{docs.length === 1 ? '' : 's'}</summary>
          <ul className="weburls__list">
            {docs.map(d => (
              <li key={d.documentId}>
                <code title={d.statusReason ?? ''}>
                  {d.documentId.slice(0, 12)}… {d.status ? `[${d.status}]` : ''}
                </code>
              </li>
            ))}
          </ul>
        </details>
      )}
      <StatusLine status={status} />
    </div>
  );
}

function StatusLine({ status }: { status: Status }): React.ReactElement | null {
  switch (status.kind) {
    case 'idle':      return null;
    case 'loading':   return <span className="weburls__status">loading…</span>;
    case 'adding':    return <span className="weburls__status">🕷 {status.sitemap ? 'crawling sitemap of' : 'fetching'} {status.url}…</span>;
    case 'ok':        return <span className="weburls__status weburls__status--ok">✓ {status.message}</span>;
    case 'error':     return <span className="weburls__status weburls__status--err">⚠ {status.message}</span>;
  }
}

function summarize(r: AddWebUrlResult): string {
  if (!r.sitemapFound) {
    return `indexed 1 page${'fallback' in r && r.fallback ? ' (no sitemap; single URL)' : ''}`;
  }
  const truncatedNote = r.truncated ? ' (capped at 100)' : '';
  const failedNote = r.failed > 0 ? `, ${r.failed} failed` : '';
  return `indexed ${r.ingested} pages from sitemap${truncatedNote}${failedNote}`;
}
