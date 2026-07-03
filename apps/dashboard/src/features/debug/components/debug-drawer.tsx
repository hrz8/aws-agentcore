import { Loader2, RefreshCcw, Save } from 'lucide-react';
import * as React from 'react';

import { useRegistry, useSaveRegistry } from '#/features/agents';
import { m } from '#/paraglide/messages.js';
import { Badge } from '#/components/ui/badge';
import { Button } from '#/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet';

import { YamlEditor } from './yaml-editor';

interface DebugDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DebugDrawer({ open, onOpenChange }: DebugDrawerProps) {
  const [draft, setDraft] = React.useState<string>('');
  const [dirty, setDirty] = React.useState<boolean>(false);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  const registryQuery = useRegistry(open);
  const save = useSaveRegistry();

  React.useEffect(() => {
    if (registryQuery.data && !dirty) {
      setDraft(registryQuery.data.text);
    }
  }, [registryQuery.data, dirty]);

  const handleReload = () => {
    setDirty(false);
    registryQuery.refetch();
  };

  const handleSave = () => {
    save.mutate(draft, {
      onSuccess: () => {
        setDirty(false);
        setSavedAt(Date.now());
      },
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-3xl">
        <SheetHeader>
          <div className="flex items-center justify-between pr-8">
            <div className="flex flex-col gap-1">
              <SheetTitle>{m.debug_drawer_title()}</SheetTitle>
              <SheetDescription>{m.debug_drawer_body()}</SheetDescription>
            </div>
            <div className="flex items-center gap-2">
              {dirty ? (
                <Badge variant="destructive">{m.debug_drawer_dirty()}</Badge>
              ) : savedAt ? (
                <Badge variant="secondary">{m.debug_drawer_saved()}</Badge>
              ) : null}
            </div>
          </div>
        </SheetHeader>

        <div className="mt-4 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReload}
            disabled={registryQuery.isFetching || save.isPending}
          >
            <RefreshCcw className="mr-1 h-3 w-3" />
            {m.debug_drawer_reload()}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!dirty || save.isPending || registryQuery.isLoading}
          >
            {save.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Save className="mr-1 h-3 w-3" />
            )}
            {m.debug_drawer_save()}
          </Button>
          {save.error ? (
            <span className="text-xs text-destructive">{(save.error as Error).message}</span>
          ) : null}
        </div>

        <div className="mt-4 rounded-md border">
          {registryQuery.isLoading ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : registryQuery.error ? (
            <div className="p-4 text-sm text-destructive">
              {(registryQuery.error as Error).message}
            </div>
          ) : (
            <YamlEditor
              value={draft}
              onChange={(next) => {
                setDraft(next);
                setDirty(true);
              }}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
