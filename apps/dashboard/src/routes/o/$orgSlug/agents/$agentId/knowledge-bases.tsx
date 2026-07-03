import { createFileRoute, Link, Outlet, useParams } from '@tanstack/react-router';

import { m } from '#/paraglide/messages.js';
import { cn } from '#/shared/utils';

export const Route = createFileRoute('/o/$orgSlug/agents/$agentId/knowledge-bases')({
  component: KnowledgeBasesLayout,
});

function KnowledgeBasesLayout() {
  const { orgSlug, agentId } = useParams({ from: '/o/$orgSlug/agents/$agentId/knowledge-bases' });
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight">{m.kb_root_title()}</h2>
        <p className="text-sm text-muted-foreground">{m.kb_root_body()}</p>
      </div>
      <nav className="flex gap-1 border-b">
        <TabLink
          to="/o/$orgSlug/agents/$agentId/knowledge-bases/documents"
          params={{ orgSlug, agentId }}
          label={m.kb_tab_documents()}
        />
        <TabLink
          to="/o/$orgSlug/agents/$agentId/knowledge-bases/web"
          params={{ orgSlug, agentId }}
          label={m.kb_tab_web()}
        />
      </nav>
      <Outlet />
    </div>
  );
}

interface TabLinkProps {
  to: string;
  params: { orgSlug: string; agentId: string };
  label: string;
}

function TabLink({ to, params, label }: TabLinkProps) {
  return (
    <Link
      to={to}
      params={params}
      search={(prev) => ({ v: (prev as { v?: string }).v })}
      className={cn(
        'relative -mb-px inline-flex h-9 items-center border-b-2 border-transparent px-3 text-sm text-muted-foreground transition-colors',
        'hover:text-foreground',
        'data-[status=active]:border-primary data-[status=active]:text-foreground data-[status=active]:font-medium',
      )}
    >
      {label}
    </Link>
  );
}
