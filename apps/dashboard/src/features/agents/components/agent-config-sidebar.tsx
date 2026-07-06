import { Link, useParams } from '@tanstack/react-router';
import { BookText, Cpu, FileText, Hammer, Info, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { m } from '#/paraglide/messages.js';
import { cn } from '#/shared/utils';

interface Item {
  to: string;
  labelKey: () => string;
  icon: LucideIcon;
}

const ITEMS: Item[] = [
  { to: '/o/$orgSlug/agents/$agentId/general', labelKey: () => m.nav_general(), icon: Info },
  { to: '/o/$orgSlug/agents/$agentId/prompt', labelKey: () => m.nav_prompt(), icon: FileText },
  { to: '/o/$orgSlug/agents/$agentId/model', labelKey: () => m.nav_model(), icon: Cpu },
  { to: '/o/$orgSlug/agents/$agentId/knowledge-bases', labelKey: () => m.nav_knowledge_base(), icon: BookText },
  { to: '/o/$orgSlug/agents/$agentId/skills', labelKey: () => m.nav_skills(), icon: Wrench },
  { to: '/o/$orgSlug/agents/$agentId/tools', labelKey: () => m.nav_tools(), icon: Hammer },
];

export function AgentConfigSidebar() {
  const params = useParams({ strict: false }) as { orgSlug?: string; agentId?: string };
  const orgSlug = params.orgSlug ?? '';
  const agentId = params.agentId ?? '';

  return (
    <aside className="hidden w-56 shrink-0 border-r bg-card/40 md:flex md:flex-col">
      <div className="px-6 pt-6 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {m.nav_configuration()}
      </div>
      <nav className="flex flex-col gap-0.5 px-3 py-2">
        {ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            params={{ orgSlug, agentId }}
            search={(prev) => ({ v: (prev as { v?: string }).v })}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground',
            )}
            activeProps={{
              className: 'bg-accent text-accent-foreground font-medium',
            }}
            activeOptions={{ exact: false }}
          >
            <item.icon className="h-4 w-4" />
            <span className="flex-1">{item.labelKey()}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
