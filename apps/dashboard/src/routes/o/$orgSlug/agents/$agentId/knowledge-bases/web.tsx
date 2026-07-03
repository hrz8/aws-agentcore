import { createFileRoute } from '@tanstack/react-router';

import { WebDocList, WebSeedForm } from '#/features/kb';

export const Route = createFileRoute('/o/$orgSlug/agents/$agentId/knowledge-bases/web')({
  component: WebPage,
});

function WebPage() {
  return (
    <div className="flex flex-col gap-4">
      <WebSeedForm />
      <WebDocList />
    </div>
  );
}
