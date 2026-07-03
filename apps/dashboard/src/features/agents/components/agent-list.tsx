import { Link, useParams } from '@tanstack/react-router';
import { Sparkles } from 'lucide-react';

import { m } from '#/paraglide/messages.js';
import { Badge } from '#/components/ui/badge';

import { useAgents, useCurrentTenant } from '../hooks';
import type { AgentIdentity } from '../types';

export function AgentList() {
  const params = useParams({ strict: false }) as { orgSlug?: string };
  const orgSlug = params.orgSlug ?? '';
  const tenant = useCurrentTenant();
  const agentsQuery = useAgents();
  const grouped = groupByAgentId(agentsQuery.data?.agents ?? []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="text-xs text-muted-foreground">
          <span className="capitalize">{tenant?.tenantSlug ?? orgSlug}</span>
          <span className="px-1">{m.agents_page_breadcrumb_sep()}</span>
          <span>{m.agents_page_title()}</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{m.agents_page_title()}</h1>
      </div>

      {agentsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{m.common_loading()}</p>
      ) : grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground">{m.agents_page_empty()}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {grouped.map((agent) => {
            const live = agent.versions.find((v) => v.enabled);
            return (
              <li key={agent.agentId}>
                <Link
                  to="/o/$orgSlug/agents/$agentId"
                  params={{ orgSlug, agentId: agent.agentId }}
                  search={{ v: undefined }}
                  className="flex items-center gap-4 rounded-xl border bg-card px-4 py-3 shadow-sm transition-colors hover:border-primary"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                    <Sparkles className="h-5 w-5" />
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium capitalize">{agent.agentSlug}</span>
                      <Badge
                        variant={live ? 'default' : 'outline'}
                        className="h-4 px-1.5 text-[10px]"
                      >
                        {live ? m.agent_status_live() : m.agent_status_draft()}
                      </Badge>
                    </div>
                    <code className="truncate text-xs text-muted-foreground">
                      {agent.agentSlug}
                    </code>
                  </div>

                  {agent.description ? (
                    <p className="hidden max-w-xs truncate text-sm text-muted-foreground md:block">
                      {agent.description}
                    </p>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function groupByAgentId(rows: AgentIdentity[]) {
  const byId = new Map<
    string,
    {
      agentId: string;
      agentSlug: string;
      description: string;
      versions: { version: string; enabled: boolean }[];
    }
  >();
  for (const r of rows) {
    const bucket = byId.get(r.agentId);
    if (!bucket) {
      byId.set(r.agentId, {
        agentId: r.agentId,
        agentSlug: r.agentSlug,
        description: r.description,
        versions: [{ version: r.version, enabled: r.enabled }],
      });
    } else {
      bucket.versions.push({ version: r.version, enabled: r.enabled });
    }
  }
  return Array.from(byId.values()).map((a) => ({
    ...a,
    versions: a.versions.sort((x, y) => x.version.localeCompare(y.version)),
  }));
}
