import { Loader2 } from 'lucide-react';
import * as React from 'react';

import { m } from '#/paraglide/messages.js';
import { Card, CardContent } from '#/components/ui/card';
import { Switch } from '#/components/ui/switch';

import { useAgentDetails, useBuiltinTools, useUpdateAgentConfig } from '../hooks';

const BUILTIN_PREFIX = 'builtin__';
const MCP_PREFIX = 'mcp__';

function toRef(name: string): string {
  return `${BUILTIN_PREFIX}${name}`;
}

export function ToolList() {
  const catalog = useBuiltinTools();
  const details = useAgentDetails();
  const update = useUpdateAgentConfig();

  // Track which tool is mid-flight so we can spinner just that row.
  const [pendingRef, setPendingRef] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const catalogEntries = React.useMemo(
    () => Object.entries(catalog.data?.tools ?? {}).sort(([a], [b]) => a.localeCompare(b)),
    [catalog.data],
  );
  const agentTools = details.data?.tools ?? [];
  const enabledBuiltins = React.useMemo(() => new Set(agentTools), [agentTools]);

  const mcpTools = agentTools.filter((t) => t.startsWith(MCP_PREFIX));
  const orphanBuiltins = agentTools.filter(
    (t) =>
      t.startsWith(BUILTIN_PREFIX)
      && !catalog.data?.tools?.[t.slice(BUILTIN_PREFIX.length)],
  );

  function toggle(name: string, next: boolean) {
    if (update.isPending || !details.data) return;
    const ref = toRef(name);
    const nextTools = next
      ? Array.from(new Set([...agentTools, ref]))
      : agentTools.filter((t) => t !== ref);
    setPendingRef(ref);
    setError(null);
    update.mutate(
      { tools: nextTools },
      {
        onSettled: () => setPendingRef(null),
        onError: (err) => setError(err instanceof Error ? err.message : String(err)),
      },
    );
  }

  const loading = catalog.isLoading || details.isLoading;
  const queryError = (catalog.error ?? details.error) as Error | null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight">{m.tools_title()}</h2>
        <p className="text-sm text-muted-foreground">{m.tools_body()}</p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">{m.tools_loading()}</p>
          </CardContent>
        </Card>
      ) : queryError ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-destructive">{queryError.message}</p>
          </CardContent>
        </Card>
      ) : catalogEntries.length === 0 ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">{m.tools_catalog_empty()}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {catalogEntries.map(([name, cfg]) => {
            const ref = toRef(name);
            const isOn = enabledBuiltins.has(ref);
            const rowBusy = pendingRef === ref;
            return (
              <li key={name}>
                <Card>
                  <div className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <code className="truncate text-sm font-medium">{name}</code>
                      <p className="mt-0.5 text-xs text-muted-foreground">{cfg.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {rowBusy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                      <Switch
                        checked={isOn}
                        disabled={update.isPending}
                        onCheckedChange={(checked) => toggle(name, checked)}
                        aria-label={m.tools_enabled_aria({ name })}
                      />
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {orphanBuiltins.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {m.tools_section_unknown()}
          </p>
          <ul className="flex flex-col gap-2">
            {orphanBuiltins.map((ref) => (
              <li key={ref}>
                <Card>
                  <div className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <code className="truncate text-sm font-medium">{ref.slice(BUILTIN_PREFIX.length)}</code>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {m.tools_unknown_hint()}
                      </p>
                    </div>
                    <Switch
                      checked
                      disabled={update.isPending}
                      onCheckedChange={() =>
                        toggle(ref.slice(BUILTIN_PREFIX.length), false)
                      }
                      aria-label={m.tools_enabled_aria({ name: ref })}
                    />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {mcpTools.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {m.tools_section_mcp()}
          </p>
          <ul className="flex flex-col gap-2">
            {mcpTools.map((ref) => (
              <li key={ref}>
                <Card>
                  <div className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <code className="truncate text-sm font-medium">
                        {ref.slice(MCP_PREFIX.length)}
                      </code>
                      <p className="mt-0.5 text-xs text-muted-foreground">{m.tools_kind_mcp()}</p>
                    </div>
                    <Switch checked disabled aria-label={m.tools_enabled_aria({ name: ref })} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
