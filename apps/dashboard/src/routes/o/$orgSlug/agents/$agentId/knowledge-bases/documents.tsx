import { createFileRoute } from '@tanstack/react-router';

import { DocumentList, DocumentUploader } from '#/features/kb';

export const Route = createFileRoute('/o/$orgSlug/agents/$agentId/knowledge-bases/documents')({
  component: DocumentsPage,
});

function DocumentsPage() {
  return (
    <div className="flex flex-col gap-4">
      <DocumentUploader />
      <DocumentList />
    </div>
  );
}
