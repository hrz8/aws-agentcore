import { queryOptions } from '@tanstack/react-query';

import { callServerFn } from '#/shared/server-fn/envelope';
import { toWireScope, type ResolvedScope } from '#/shared/scope';

import {
  getAgentDetailsServerFn,
  getRegistryServerFn,
  listAgentsServerFn,
  listBuiltinToolsServerFn,
  listTenantsServerFn,
} from './server-fns';

export const agentsQueries = {
  all: ['agents'] as const,

  tenants: () =>
    queryOptions({
      queryKey: [...agentsQueries.all, 'tenants'] as const,
      queryFn: () => callServerFn(listTenantsServerFn),
      staleTime: 5 * 60_000,
    }),

  list: (tenantSlug: string) =>
    queryOptions({
      queryKey: [...agentsQueries.all, 'list', tenantSlug] as const,
      queryFn: () =>
        callServerFn(listAgentsServerFn, { tenantSlug }),
      enabled: !!tenantSlug,
    }),

  registry: () =>
    queryOptions({
      queryKey: [...agentsQueries.all, 'registry'] as const,
      queryFn: () => callServerFn(getRegistryServerFn),
    }),

  details: (scope: ResolvedScope) =>
    queryOptions({
      queryKey: [
        ...agentsQueries.all,
        'details',
        scope.tenantId,
        scope.agentId,
        scope.agentVersion,
      ] as const,
      queryFn: () =>
        callServerFn(getAgentDetailsServerFn, { scope: toWireScope(scope) }),
      staleTime: 0,
    }),

  builtinTools: () =>
    queryOptions({
      queryKey: [...agentsQueries.all, 'builtin-tools'] as const,
      queryFn: () => callServerFn(listBuiltinToolsServerFn),
      staleTime: 5 * 60_000,
    }),
};
