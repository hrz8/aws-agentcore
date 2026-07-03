import { useNavigate, useParams } from '@tanstack/react-router';
import { Sparkles } from 'lucide-react';

import { m } from '#/paraglide/messages.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select';

import { useAgents } from '../hooks';
import type { AgentIdentity } from '../types';

export function AgentSelector() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { orgSlug?: string; agentId?: string };
  const agentsQuery = useAgents();
  const byId = dedupeByAgentId(agentsQuery.data?.agents ?? []);
  const active = params.agentId ?? '';
  const orgSlug = params.orgSlug ?? '';

  return (
    <Select
      value={active}
      onValueChange={(agentId) => {
        navigate({
          to: '/o/$orgSlug/agents/$agentId',
          params: { orgSlug, agentId },
          search: { v: undefined },
        });
      }}
    >
      <SelectTrigger className="h-8 w-56 gap-2">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
        <SelectValue placeholder={m.agents_selector_placeholder()} />
      </SelectTrigger>
      <SelectContent>
        {agentsQuery.isLoading ? (
          <SelectItem value="__loading" disabled>
            {m.agents_selector_loading()}
          </SelectItem>
        ) : byId.length === 0 ? (
          <SelectItem value="__empty" disabled>
            {m.agents_selector_empty()}
          </SelectItem>
        ) : (
          byId.map((a) => (
            <SelectItem key={a.agentId} value={a.agentId}>
              <span className="capitalize">{a.agentSlug}</span>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

function dedupeByAgentId(rows: AgentIdentity[]): AgentIdentity[] {
  const seen = new Map<string, AgentIdentity>();
  for (const r of rows) {
    const existing = seen.get(r.agentId);
    if (!existing || (!existing.enabled && r.enabled)) seen.set(r.agentId, r);
  }
  return Array.from(seen.values()).sort((a, b) => a.agentSlug.localeCompare(b.agentSlug));
}
