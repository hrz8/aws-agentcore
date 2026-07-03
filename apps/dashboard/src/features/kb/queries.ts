import { queryOptions } from '@tanstack/react-query';

import { callServerFn } from '#/shared/server-fn/envelope';
import { toWireScope, type ResolvedScope } from '#/shared/scope';

import { kbJobServerFn, listDocumentsServerFn, listWebUrlsServerFn } from './server-fns';

export const kbQueries = {
  all: ['kb'] as const,

  documents: (scope: ResolvedScope) =>
    queryOptions({
      queryKey: [...kbQueries.all, 'documents', scope.tenantId, scope.agentId, scope.agentVersion] as const,
      queryFn: () =>
        callServerFn(listDocumentsServerFn, { scope: toWireScope(scope) }),
    }),

  webUrls: (scope: ResolvedScope) =>
    queryOptions({
      queryKey: [...kbQueries.all, 'web-urls', scope.tenantId, scope.agentId, scope.agentVersion] as const,
      queryFn: () =>
        callServerFn(listWebUrlsServerFn, { scope: toWireScope(scope) }),
    }),

  job: (scope: ResolvedScope, id: string) =>
    queryOptions({
      queryKey: [...kbQueries.all, 'job', id] as const,
      queryFn: () =>
        callServerFn(kbJobServerFn, { scope: toWireScope(scope), id }),
    }),
};
