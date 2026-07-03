import { createFileRoute, notFound } from '@tanstack/react-router';

import { AppShell } from '#/components/layout/app-shell';
import { agentsQueries } from '#/features/agents';

// Prefetch so children render synchronously on SSR + hydration and avoid a
// loading-branch mismatch.
export const Route = createFileRoute('/o/$orgSlug')({
  beforeLoad: async ({ context, params }) => {
    const tenantsData = await context.queryClient.ensureQueryData(agentsQueries.tenants());
    const tenant = (tenantsData.tenants ?? []).find((t) => t.tenantSlug === params.orgSlug);
    if (!tenant) {
      throw notFound();
    }
    await context.queryClient.ensureQueryData(agentsQueries.list(tenant.tenantSlug));
  },
  component: AppShell,
});
