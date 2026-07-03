import { m } from '#/paraglide/messages.js';
import { Card, CardContent } from '#/components/ui/card';
import { Switch } from '#/components/ui/switch';

import { useAgentTools } from '../hooks';

export function ToolList() {
  const query = useAgentTools();
  const tools = query.data?.tools ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight">{m.tools_title()}</h2>
        <p className="text-sm text-muted-foreground">{m.tools_body()}</p>
      </div>

      {query.isLoading ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">{m.tools_loading()}</p>
          </CardContent>
        </Card>
      ) : query.error ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-destructive">{(query.error as Error).message}</p>
          </CardContent>
        </Card>
      ) : tools.length === 0 ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">{m.tools_empty()}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {tools.map((ref) => {
            const parsed = parseToolRef(ref);
            return (
              <li key={ref}>
                <Card>
                  <div className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <code className="truncate text-sm font-medium">{parsed.name}</code>
                      <p className="mt-0.5 text-xs text-muted-foreground">{parsed.subtitle}</p>
                    </div>
                    <Switch
                      checked
                      disabled
                      aria-label={m.tools_enabled_aria({ name: parsed.name })}
                    />
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function parseToolRef(ref: string): { name: string; subtitle: string } {
  if (ref.startsWith('builtin__')) {
    return { name: ref.slice('builtin__'.length), subtitle: m.tools_kind_builtin() };
  }
  if (ref.startsWith('mcp__')) {
    return { name: ref.slice('mcp__'.length), subtitle: m.tools_kind_mcp() };
  }
  return { name: ref, subtitle: m.tools_kind_unknown() };
}
