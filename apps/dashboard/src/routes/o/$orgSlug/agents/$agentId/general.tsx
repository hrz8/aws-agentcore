import { createFileRoute } from '@tanstack/react-router';

import { GeneralEditor } from '#/features/agents';

export const Route = createFileRoute('/o/$orgSlug/agents/$agentId/general')({
  component: () => <GeneralEditor />,
});
