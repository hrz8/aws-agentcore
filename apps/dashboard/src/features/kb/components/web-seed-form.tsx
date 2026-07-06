import { useBlocker } from '@tanstack/react-router';
import { CheckCircle2, Globe, Loader2, Network, XCircle } from 'lucide-react';
import * as React from 'react';

import { m } from '#/paraglide/messages.js';
import { Button } from '#/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card';
import { Input } from '#/components/ui/input';
import { Label } from '#/components/ui/label';
import { cn } from '#/shared/utils';

import { useAddWebUrl } from '../hooks';
import type { AddWebUrlResult } from '../types';

export function WebSeedForm() {
  const [url, setUrl] = React.useState('');
  const [sitemap, setSitemap] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const add = useAddWebUrl();

  const trimmed = url.trim();
  const looksLikeUrl = React.useMemo(() => {
    if (!trimmed) {
      return false;
    }
    try {
      const u = new URL(trimmed);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }, [trimmed]);
  const canSubmit = looksLikeUrl && !add.isPending;

  useBlocker({
    shouldBlockFn: () => {
      if (!add.isPending) return false;
      return !window.confirm(m.kb_web_leave_confirm());
    },
    enableBeforeUnload: () => add.isPending,
  });

  function submit() {
    if (!canSubmit) {
      return;
    }
    setMessage(null);
    add.mutate(
      { url: trimmed, sitemap },
      {
        onSuccess: (r) => {
          setUrl('');
          setMessage({ tone: 'ok', text: summarize(r) });
        },
        onError: (err) => {
          setMessage({
            tone: 'err',
            text: err instanceof Error ? err.message : String(err),
          });
        },
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.kb_web_seed_title()}</CardTitle>
        <CardDescription>{m.kb_web_seed_body()}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="url">{m.kb_web_seed_url_label()}</Label>
          <div className="relative">
            <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="url"
              type="url"
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              placeholder={m.kb_web_seed_url_placeholder()}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (message) {
                  setMessage(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSubmit) {
                  submit();
                }
              }}
              disabled={add.isPending}
              className="pl-9"
            />
          </div>
          {trimmed && !looksLikeUrl ? (
            <span className="text-xs text-destructive">{m.kb_web_seed_url_invalid()}</span>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor="sitemap"
            className={cn(
              'inline-flex select-none items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors',
              sitemap
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-input bg-transparent text-muted-foreground hover:text-foreground',
              add.isPending && 'pointer-events-none opacity-50',
            )}
          >
            <input
              id="sitemap"
              type="checkbox"
              checked={sitemap}
              onChange={(e) => setSitemap(e.target.checked)}
              disabled={add.isPending}
              className="sr-only"
            />
            <Network className="h-3.5 w-3.5" />
            <span>{m.kb_web_seed_follow_sitemap()}</span>
          </label>

          <Button onClick={submit} disabled={!canSubmit}>
            {add.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Globe className="mr-2 h-4 w-4" />
            )}
            {add.isPending ? m.kb_web_seed_ingesting() : m.kb_web_seed_ingest()}
          </Button>
        </div>

        {message ? (
          <div
            className={cn(
              'flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
              message.tone === 'ok'
                ? 'border-primary/30 bg-primary/5 text-primary'
                : 'border-destructive/30 bg-destructive/5 text-destructive',
            )}
          >
            {message.tone === 'ok' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span className="min-w-0 break-words">{message.text}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function summarize(r: AddWebUrlResult): string {
  if (!r.sitemapFound) {
    return 'fallback' in r && r.fallback
      ? m.kb_web_seed_summary_single_fallback()
      : m.kb_web_seed_summary_single();
  }
  const truncatedNote = r.truncated ? m.kb_web_seed_summary_truncated_note() : '';
  const failedNote = r.failed > 0
    ? m.kb_web_seed_summary_failed_note({ failed: r.failed.toString() })
    : '';
  return m.kb_web_seed_summary_sitemap({
    ingested: r.ingested.toString(),
    truncatedNote,
    failedNote,
  });
}
