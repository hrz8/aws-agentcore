import { useParams } from '@tanstack/react-router';

import { m } from '#/paraglide/messages.js';
import { Badge } from '#/components/ui/badge';

import { useAgents, useCurrentScope } from '../hooks';
import { TryOutButton } from './try-out-button';
import { VersionSelector } from './version-selector';

export function AgentHeader() {
  const params = useParams({ strict: false }) as { agentId?: string };
  const scope = useCurrentScope();
  const agentsQuery = useAgents();
  const row = (agentsQuery.data?.agents ?? []).find(
    (a) => a.agentId === params.agentId && a.version === scope?.agentVersion,
  );
  const agentId = params.agentId ?? '';

  return (
    <div className="flex items-center justify-between gap-4 border-b bg-card/30 px-8 py-5">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-2xl font-semibold capitalize tracking-tight">
            {row?.agentSlug ?? m.agent_fallback_name()}
          </h1>
          {row ? (
            <Badge
              variant={row.enabled ? 'default' : 'outline'}
              className="text-[10px]"
            >
              {row.enabled ? m.agent_status_live() : m.agent_status_draft()}
            </Badge>
          ) : null}
        </div>
        {row ? (
          <div className="truncate text-xs text-muted-foreground">
            <code>{row.agentSlug}</code>
            <span className="px-1">·</span>
            <code>{agentId}</code>
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <TryOutButton />
        <VersionSelector />
      </div>
    </div>
  );
}
