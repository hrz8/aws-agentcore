import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/o/$orgSlug/agents/$agentId/knowledge-bases/')({
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: '/o/$orgSlug/agents/$agentId/knowledge-bases/documents',
      params: { orgSlug: params.orgSlug, agentId: params.agentId },
      search: { v: (search as { v?: string }).v },
    });
  },
});
