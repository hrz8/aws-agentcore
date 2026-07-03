import { queryOptions } from '@tanstack/react-query';

import { callServerFn } from '#/shared/server-fn/envelope';
import { toWireScope, type ResolvedScope } from '#/shared/scope';

import { listSkillsServerFn } from './server-fns';

export const skillsQueries = {
  all: ['skills'] as const,

  list: (scope: ResolvedScope) =>
    queryOptions({
      queryKey: [...skillsQueries.all, 'list', scope.tenantId, scope.agentId, scope.agentVersion] as const,
      queryFn: () =>
        callServerFn(listSkillsServerFn, { scope: toWireScope(scope) }),
    }),
};
