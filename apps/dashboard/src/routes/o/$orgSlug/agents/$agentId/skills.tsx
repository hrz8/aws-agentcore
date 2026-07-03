import { createFileRoute } from '@tanstack/react-router';

import { SkillList, SkillUploader } from '#/features/skills';

export const Route = createFileRoute('/o/$orgSlug/agents/$agentId/skills')({
  component: SkillsPage,
});

function SkillsPage() {
  return (
    <div className="flex flex-col gap-4">
      <SkillUploader />
      <SkillList />
    </div>
  );
}
