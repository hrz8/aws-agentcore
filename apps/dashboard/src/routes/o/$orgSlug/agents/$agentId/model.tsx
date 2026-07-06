import { createFileRoute } from '@tanstack/react-router';

import { ModelEditor } from '#/features/agents';

export const Route = createFileRoute('/o/$orgSlug/agents/$agentId/model')({
  component: () => <ModelEditor />,
});
