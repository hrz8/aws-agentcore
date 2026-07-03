import { createFileRoute } from '@tanstack/react-router';

import { ToolList } from '#/features/agents';

export const Route = createFileRoute('/o/$orgSlug/agents/$agentId/tools')({
  component: () => <ToolList />,
});
