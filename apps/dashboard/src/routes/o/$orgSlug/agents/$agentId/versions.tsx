import { createFileRoute } from '@tanstack/react-router';

import { VersionList } from '#/features/agents';

export const Route = createFileRoute('/o/$orgSlug/agents/$agentId/versions')({
  component: () => <VersionList />,
});
