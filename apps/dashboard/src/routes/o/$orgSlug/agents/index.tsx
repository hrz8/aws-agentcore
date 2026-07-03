import { createFileRoute } from '@tanstack/react-router';

import { AgentList } from '#/features/agents';
import { GlobalSidebar } from '#/components/layout/global-sidebar';

export const Route = createFileRoute('/o/$orgSlug/agents/')({
  component: AgentsListRoute,
});

function AgentsListRoute() {
  return (
    <>
      <GlobalSidebar />
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto w-full max-w-5xl px-6 py-8 md:px-10">
          <AgentList />
        </div>
      </main>
    </>
  );
}
