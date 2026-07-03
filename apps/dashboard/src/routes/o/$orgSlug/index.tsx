import { createFileRoute } from '@tanstack/react-router';

import { GlobalSidebar } from '#/components/layout/global-sidebar';
import { m } from '#/paraglide/messages.js';

export const Route = createFileRoute('/o/$orgSlug/')({
  component: OverviewRoute,
});

function OverviewRoute() {
  return (
    <>
      <GlobalSidebar />
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto w-full max-w-5xl px-6 py-8 md:px-10">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">{m.overview_title()}</h1>
            <p className="text-sm text-muted-foreground">{m.overview_body()}</p>
          </div>
        </div>
      </main>
    </>
  );
}
