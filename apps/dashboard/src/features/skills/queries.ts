import { queryOptions } from '@tanstack/react-query';

import { callServerFn } from '#/shared/server-fn/envelope';
import { toWireScope, type ResolvedScope } from '#/shared/scope';

import { getSkillContentServerFn, listSkillsServerFn } from './server-fns';

export const skillsQueries = {
  all: ['skills'] as const,

  list: (scope: ResolvedScope) =>
    queryOptions({
      queryKey: [...skillsQueries.all, 'list', scope.tenantId, scope.agentId, scope.agentVersion] as const,
      queryFn: () =>
        callServerFn(listSkillsServerFn, { scope: toWireScope(scope) }),
    }),

  content: (scope: ResolvedScope, name: string) =>
    queryOptions({
      queryKey: [
        ...skillsQueries.all,
        'content',
        scope.tenantId,
        scope.agentId,
        scope.agentVersion,
        name,
      ] as const,
      queryFn: () =>
        callServerFn(getSkillContentServerFn, { scope: toWireScope(scope), name }),
    }),
};
