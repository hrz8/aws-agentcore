import { createFileRoute, notFound, Outlet, useMatchRoute } from '@tanstack/react-router';

import {
  AgentConfigSidebar,
  agentsQueries,
  AgentHeader,
  AgentPrimarySidebar,
} from '#/features/agents';

type AgentScopeSearch = { v: string | undefined };

export const Route = createFileRoute('/o/$orgSlug/agents/$agentId')({
  validateSearch: (search: Record<string, unknown>): AgentScopeSearch => ({
    v: typeof search.v === 'string' && search.v.length > 0 ? search.v : undefined,
  }),
  beforeLoad: async ({ context, params }) => {
    const tenantsData = await context.queryClient.ensureQueryData(agentsQueries.tenants());
    const tenant = (tenantsData.tenants ?? []).find((t) => t.tenantSlug === params.orgSlug);
    if (!tenant) throw notFound();
    const agentsData = await context.queryClient.ensureQueryData(
      agentsQueries.list(tenant.tenantSlug),
    );
    const found = (agentsData.agents ?? []).some((a) => a.agentId === params.agentId);
    if (!found) throw notFound();
  },
  component: AgentScopeLayout,
});

function AgentScopeLayout() {
  const matchRoute = useMatchRoute();
  const showConfigSidebar = !matchRoute({
    to: '/o/$orgSlug/agents/$agentId/versions',
    fuzzy: true,
  });

  return (
    <>
      <AgentPrimarySidebar />
      <div className="flex flex-1 flex-col">
        <AgentHeader />
        <div className="flex flex-1">
          {showConfigSidebar ? <AgentConfigSidebar /> : null}
          <main className="flex-1 overflow-x-hidden">
            <div className="mx-auto w-full max-w-4xl px-6 py-8 md:px-10">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
