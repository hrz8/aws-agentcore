import { Link, useParams } from '@tanstack/react-router';
import { LayoutGrid, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { useCurrentTenant } from '#/features/agents';
import { m } from '#/paraglide/messages.js';
import { cn } from '#/shared/utils';

interface NavItem {
  to: string;
  labelKey: () => string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { to: '/o/$orgSlug', labelKey: () => m.nav_overview(), icon: LayoutGrid },
  { to: '/o/$orgSlug/agents', labelKey: () => m.nav_agents(), icon: Sparkles },
];

export function GlobalSidebar() {
  const params = useParams({ strict: false }) as { orgSlug?: string };
  const tenant = useCurrentTenant();
  const orgSlug = params.orgSlug ?? '';

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-sidebar text-sidebar-foreground md:flex md:flex-col">
      <div className="px-6 pt-6 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {tenant?.tenantSlug ?? orgSlug}
      </div>
      <nav className="flex flex-col gap-0.5 px-3 py-2">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            params={{ orgSlug }}
            className={cn(
              'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            )}
            activeProps={{
              className:
                'bg-sidebar-accent text-sidebar-accent-foreground font-semibold before:absolute before:-left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-sidebar-primary',
            }}
            activeOptions={{ exact: item.to === '/o/$orgSlug' }}
          >
            <item.icon className="h-4 w-4" />
            <span className="flex-1">{item.labelKey()}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
