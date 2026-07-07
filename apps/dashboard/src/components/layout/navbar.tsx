import { Link, useParams } from '@tanstack/react-router';

import { AgentSelector } from '#/features/agents';
import { m } from '#/paraglide/messages.js';

import { LanguageSwitcher } from './language-switcher';
import { TenantSelector } from './tenant-selector';
import { ThemeSwitcher } from './theme-switcher';

interface NavbarProps {
  onOpenDebug?: () => void;
}

export function Navbar(_props: NavbarProps) {
  const params = useParams({ strict: false }) as { orgSlug?: string; agentId?: string };
  const inAgentScope = Boolean(params.agentId);
  const orgSlug = params.orgSlug ?? '';

  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center gap-3 border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Link
        to="/o/$orgSlug"
        params={{ orgSlug }}
        className="flex items-center gap-2 font-bold tracking-tight"
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-sm border border-primary/40 text-[10px] text-primary">
          {m.app_brand_mark()}
        </span>
        <span>{m.app_brand_word()}</span>
      </Link>

      <TenantSelector />

      {inAgentScope ? (
        <>
          <span className="text-muted-foreground">{m.agents_page_breadcrumb_sep()}</span>
          <AgentSelector />
        </>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>
    </header>
  );
}
