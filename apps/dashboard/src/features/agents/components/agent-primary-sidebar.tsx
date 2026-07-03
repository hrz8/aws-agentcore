import { Link, useMatchRoute, useParams } from '@tanstack/react-router';
import { ChevronLeft, GitBranch, SlidersHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { m } from '#/paraglide/messages.js';
import { cn } from '#/shared/utils';

import { useAgents } from '../hooks';

export function AgentPrimarySidebar() {
  const params = useParams({ strict: false }) as { orgSlug?: string; agentId?: string };
  const orgSlug = params.orgSlug ?? '';
  const agentId = params.agentId ?? '';
  const agentsQuery = useAgents();
  const agentSlug = (agentsQuery.data?.agents ?? []).find(
    (a) => a.agentId === agentId,
  )?.agentSlug;

  const matchRoute = useMatchRoute();
  const onVersions = !!matchRoute({
    to: '/o/$orgSlug/agents/$agentId/versions',
    fuzzy: true,
  });
  const onConfiguration = !onVersions;

  return (
    <aside className="hidden w-52 shrink-0 border-r bg-sidebar text-sidebar-foreground md:flex md:flex-col">
      <Link
        to="/o/$orgSlug/agents"
        params={{ orgSlug }}
        className="mx-3 mt-4 mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        {m.nav_all_agents()}
      </Link>
      <div className="px-6 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {agentSlug ?? m.agent_fallback_name()}
      </div>
      <nav className="flex flex-col gap-0.5 px-3 py-2">
        <PrimaryItem
          to="/o/$orgSlug/agents/$agentId"
          orgSlug={orgSlug}
          agentId={agentId}
          icon={SlidersHorizontal}
          label={m.nav_configuration()}
          active={onConfiguration}
        />
        <PrimaryItem
          to="/o/$orgSlug/agents/$agentId/versions"
          orgSlug={orgSlug}
          agentId={agentId}
          icon={GitBranch}
          label={m.nav_versions()}
          active={onVersions}
        />
      </nav>
    </aside>
  );
}

interface PrimaryItemProps {
  to: string;
  orgSlug: string;
  agentId: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
}

function PrimaryItem({ to, orgSlug, agentId, icon: Icon, label, active }: PrimaryItemProps) {
  return (
    <Link
      to={to}
      params={{ orgSlug, agentId }}
      search={(prev) => ({ v: (prev as { v?: string }).v })}
      className={cn(
        'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold before:absolute before:-left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-sidebar-primary'
          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1">{label}</span>
    </Link>
  );
}
