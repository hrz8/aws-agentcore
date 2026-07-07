import { useBlocker } from '@tanstack/react-router';
import { CheckCircle2, Loader2, Save, XCircle } from 'lucide-react';
import * as React from 'react';

import { parseSkillMd } from '@repo/skills/format';

import { MarkdownEditor } from '#/components/markdown-editor';
import { Button } from '#/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet';
import { m } from '#/paraglide/messages.js';
import { cn } from '#/shared/utils';

import { useSkillContent, useUpdateSkillMd } from '../hooks';

interface SkillEditorDrawerProps {
  name: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SkillEditorDrawer({ name, open, onOpenChange }: SkillEditorDrawerProps) {
  const contentQuery = useSkillContent(open ? name : null);
  const update = useUpdateSkillMd();

  const serverSkillMd = contentQuery.data?.skillMd ?? '';
  const [draft, setDraft] = React.useState('');
  const [status, setStatus] = React.useState<
    { kind: 'ok'; text: string } | { kind: 'err'; text: string } | null
  >(null);
  const syncedRef = React.useRef<string>('');

  React.useEffect(() => {
    if (!open) {
      setDraft('');
      setStatus(null);
      syncedRef.current = '';
      return;
    }
    if (contentQuery.data && syncedRef.current !== serverSkillMd) {
      setDraft(serverSkillMd);
      syncedRef.current = serverSkillMd;
    }
  }, [open, contentQuery.data, serverSkillMd]);

  const dirty = draft !== syncedRef.current && contentQuery.data !== undefined;
  const validationError = React.useMemo(() => localValidate(draft, name), [draft, name]);
  const canSave = dirty && !update.isPending && !validationError && !contentQuery.isLoading;

  useBlocker({
    shouldBlockFn: () => {
      if (!dirty) return false;
      return !window.confirm(m.skills_editor_leave_confirm());
    },
    enableBeforeUnload: () => dirty,
  });

  function save() {
    if (!canSave || !name) return;
    setStatus(null);
    update.mutate(
      { name, skillMd: draft },
      {
        onSuccess: () => {
          syncedRef.current = draft;
          setStatus({ kind: 'ok', text: m.skills_editor_saved() });
        },
        onError: (err) => {
          setStatus({
            kind: 'err',
            text: err instanceof Error ? err.message : String(err),
          });
        },
      },
    );
  }

  function handleClose(next: boolean) {
    if (!next && dirty) {
      if (!window.confirm(m.skills_editor_leave_confirm())) return;
    }
    onOpenChange(next);
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-4xl">
        <SheetHeader>
          <SheetTitle>
            {m.skills_editor_title()}
            {name ? <span className="ml-2 font-mono text-sm text-muted-foreground">{name}</span> : null}
          </SheetTitle>
          <SheetDescription>
            {m.skills_editor_body()}
            <br />
            <span className="text-xs">{m.skills_editor_refresh_note()}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-hidden">
          {contentQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">{m.common_loading()}</p>
          ) : contentQuery.error ? (
            <p className="text-sm text-destructive">
              {m.skills_editor_load_failed({
                message:
                  contentQuery.error instanceof Error
                    ? contentQuery.error.message
                    : String(contentQuery.error),
              })}
            </p>
          ) : (
            <MarkdownEditor
              value={draft}
              onChange={(next) => {
                setDraft(next);
                if (status) setStatus(null);
              }}
              height="calc(100vh - 22rem)"
              disabled={update.isPending}
            />
          )}
        </div>

        <SheetFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs">
            {dirty ? (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                {m.skills_editor_dirty()}
              </span>
            ) : null}
            {validationError ? (
              <span className="min-w-0 break-words text-destructive">
                {m.skills_editor_validation_prefix({ message: validationError })}
              </span>
            ) : status ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1',
                  status.kind === 'ok' ? 'text-primary' : 'text-destructive',
                )}
              >
                {status.kind === 'ok' ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                <span className="min-w-0 break-words">{status.text}</span>
              </span>
            ) : null}
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => handleClose(false)} disabled={update.isPending}>
              {m.common_cancel()}
            </Button>
            <Button onClick={save} disabled={!canSave}>
              {update.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {m.skills_editor_save()}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function localValidate(text: string, expectedName: string | null): string | null {
  if (!text.trim() || !expectedName) return null;
  try {
    const { frontmatter } = parseSkillMd(text);
    if (frontmatter.name !== expectedName) {
      return `frontmatter name "${frontmatter.name}" must equal "${expectedName}" (renaming is not supported here)`;
    }
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}
