import { createFileRoute } from '@tanstack/react-router';

import { SystemPromptEditor } from '#/features/agents';

export const Route = createFileRoute('/o/$orgSlug/agents/$agentId/prompt')({
  component: () => <SystemPromptEditor />,
});
