import { CheckCircle2, Loader2, RotateCcw, Save, XCircle } from 'lucide-react';
import * as React from 'react';

import { m } from '#/paraglide/messages.js';
import { Button } from '#/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card';
import { Label } from '#/components/ui/label';
import { Textarea } from '#/components/ui/textarea';
import { cn } from '#/shared/utils';

import { useAgentDetails, useUpdateAgentConfig } from '../hooks';

export function GeneralEditor() {
  const query = useAgentDetails();
  const update = useUpdateAgentConfig();

  const serverValue = query.data?.description ?? '';
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

  function save() {
    if (!canSave) return;
    setMessage(null);
    update.mutate(
      { description: draft },
      {
        onSuccess: () => setMessage({ tone: 'ok', text: m.general_saved() }),
        onError: (err) =>
          setMessage({
            tone: 'err',
            text: err instanceof Error ? err.message : String(err),
          }),
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
        <h2 className="text-xl font-semibold tracking-tight">{m.general_title()}</h2>
        <p className="text-sm text-muted-foreground">{m.general_body()}</p>
      </div>

      {query.isLoading ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">{m.general_loading()}</p>
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
            <CardTitle>{m.general_card_title()}</CardTitle>
            <CardDescription>{m.general_card_body()}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label>{m.general_description_label()}</Label>
              <Textarea
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (message) setMessage(null);
                }}
                placeholder={m.general_description_placeholder()}
                disabled={update.isPending}
                maxLength={1000}
                className="min-h-[6rem]"
              />
              <p className="text-[11px] text-muted-foreground">
                {m.general_description_hint({ length: String(draft.length) })}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={reset} disabled={!dirty || update.isPending}>
                <RotateCcw className="mr-2 h-4 w-4" />
                {m.general_reset()}
              </Button>
              <Button onClick={save} disabled={!canSave}>
                {update.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {m.general_save()}
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
