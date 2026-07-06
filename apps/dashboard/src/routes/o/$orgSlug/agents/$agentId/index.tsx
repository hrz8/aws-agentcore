import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/o/$orgSlug/agents/$agentId/')({
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: '/o/$orgSlug/agents/$agentId/general',
      params: { orgSlug: params.orgSlug, agentId: params.agentId },
      search: { v: (search as { v?: string }).v },
    });
  },
});
