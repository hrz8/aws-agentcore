import { createFileRoute, redirect } from '@tanstack/react-router';

import { listTenantsServerFn } from '#/features/agents/server-fns';
import { callServerFn } from '#/shared/server-fn/envelope';

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const { tenants } = await callServerFn(listTenantsServerFn);
    const orgSlug = tenants[0]?.tenantSlug;
    if (!orgSlug) {
      throw new Error('No tenants configured in the registry');
    }
    throw redirect({ to: '/o/$orgSlug', params: { orgSlug } });
  },
});
