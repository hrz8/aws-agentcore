import { useBlocker } from '@tanstack/react-router';
import { CheckCircle2, Loader2, RotateCcw, Save, XCircle } from 'lucide-react';
import * as React from 'react';

import { m } from '#/paraglide/messages.js';
import { MarkdownEditor } from '#/components/markdown-editor';
import { Button } from '#/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card';
import { cn } from '#/shared/utils';

import { useAgentDetails, useUpdateAgentConfig } from '../hooks';

export function SystemPromptEditor() {
  const query = useAgentDetails();
  const update = useUpdateAgentConfig();

  const serverValue = query.data?.systemPrompt ?? '';
  const [draft, setDraft] = React.useState(serverValue);
  const [message, setMessage] = React.useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const lastSyncedRef = React.useRef(serverValue);
  React.useEffect(() => {
    if (lastSyncedRef.current !== serverValue) {
      setDraft(serverValue);
      lastSyncedRef.current = serverValue;
    }
  }, [serverValue]);

  const dirty = draft !== serverValue;
  const canSave = dirty && draft.trim().length > 0 && !update.isPending;

  useBlocker({
    shouldBlockFn: () => {
      if (!dirty) return false;
      return !window.confirm(m.skills_editor_leave_confirm());
    },
    enableBeforeUnload: () => dirty,
  });

  function save() {
    if (!canSave) return;
    setMessage(null);
    update.mutate(
      { systemPrompt: draft },
      {
        onSuccess: () => {
          setMessage({ tone: 'ok', text: m.prompt_saved() });
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

  function reset() {
    setDraft(serverValue);
    setMessage(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight">{m.prompt_title()}</h2>
        <p className="text-sm text-muted-foreground">{m.prompt_body()}</p>
      </div>

      {query.isLoading ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">{m.prompt_loading()}</p>
          </CardContent>
        </Card>
      ) : query.error ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-destructive">{(query.error as Error).message}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{m.prompt_card_title()}</CardTitle>
            <CardDescription>{m.prompt_card_body()}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <MarkdownEditor
              value={draft}
              onChange={(next) => {
                setDraft(next);
                if (message) setMessage(null);
              }}
              placeholder={m.prompt_placeholder()}
              disabled={update.isPending}
              height="60vh"
            />

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={reset} disabled={!dirty || update.isPending}>
                <RotateCcw className="mr-2 h-4 w-4" />
                {m.prompt_reset()}
              </Button>
              <Button onClick={save} disabled={!canSave}>
                {update.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {m.prompt_save()}
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
      )}
    </div>
  );
}
