import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useSearch } from '@tanstack/react-router';
import * as React from 'react';

import type { ModelDef, ToolRef } from '@repo/registry';

import { callServerFn } from '#/shared/server-fn/envelope';
import { toWireScope, type ResolvedScope } from '#/shared/scope';

import { agentsQueries } from './queries';
import { putRegistryServerFn, updateAgentConfigServerFn } from './server-fns';
import type { AgentIdentity } from './types';

export function useTenants() {
  return useQuery(agentsQueries.tenants());
}

export function useCurrentTenant(): { tenantId: string; tenantSlug: string; tenantName: string } | null {
  const params = useParams({ strict: false }) as { orgSlug?: string };
  const tenants = useTenants();
  return React.useMemo(() => {
    if (!params.orgSlug) {
      return null;
    }
    const match = (tenants.data?.tenants ?? []).find((t) => t.tenantSlug === params.orgSlug);
    return match ?? null;
  }, [params.orgSlug, tenants.data]);
}

export function useAgents() {
  const tenant = useCurrentTenant();
  return useQuery(agentsQueries.list(tenant?.tenantSlug ?? ''));
}

export function useRegistry(enabled = true) {
  return useQuery({ ...agentsQueries.registry(), enabled });
}

export function useSaveRegistry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => callServerFn(putRegistryServerFn, { text }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agentsQueries.all });
    },
  });
}

export function useCurrentScope(): ResolvedScope | null {
  const params = useParams({ strict: false }) as { agentId?: string };
  const search = useSearch({ strict: false }) as { v?: string };
  const tenant = useCurrentTenant();
  const agentsQuery = useAgents();

  return React.useMemo(() => {
    if (!params.agentId || !tenant) {
      return null;
    }
    if (search.v) {
      return {
        tenantId: tenant.tenantId,
        tenantSlug: tenant.tenantSlug,
        agentId: params.agentId,
        agentVersion: search.v,
      };
    }
    const versions = (agentsQuery.data?.agents ?? []).filter(
      (a) => a.agentId === params.agentId,
    );
    if (versions.length === 0) {
      return null;
    }
    const chosen = versions.find((v) => v.enabled) ?? versions[0];
    if (!chosen) {
      return null;
    }
    return {
      tenantId: chosen.tenantId,
      tenantSlug: chosen.tenantSlug,
      agentId: chosen.agentId,
      agentVersion: chosen.version,
    };
  }, [params.agentId, search.v, tenant, agentsQuery.data]);
}

export function useAgentVersions(): AgentIdentity[] {
  const params = useParams({ strict: false }) as { agentId?: string };
  const agentsQuery = useAgents();
  return React.useMemo(() => {
    if (!params.agentId) {
      return [];
    }
    return (agentsQuery.data?.agents ?? [])
      .filter((a) => a.agentId === params.agentId)
      .sort((a, b) => a.version.localeCompare(b.version));
  }, [params.agentId, agentsQuery.data]);
}

export function useAgentDetails() {
  const scope = useCurrentScope();
  return useQuery({
    ...agentsQueries.details(scope ?? {
      tenantId: '',
      tenantSlug: '',
      agentId: '',
      agentVersion: '',
    }),
    enabled: !!scope,
  });
}

export type AgentConfigPatch = {
  description?: string;
  systemPrompt?: string;
  model?: ModelDef;
  tools?: ToolRef[];
};

export function useBuiltinTools() {
  return useQuery(agentsQueries.builtinTools());
}

export function useUpdateAgentConfig() {
  const qc = useQueryClient();
  const scope = useCurrentScope();
  return useMutation({
    mutationFn: (patch: AgentConfigPatch) => {
      if (!scope) {
        throw new Error('useUpdateAgentConfig: no active scope');
      }
      return callServerFn(updateAgentConfigServerFn, {
        scope: toWireScope(scope),
        patch,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agentsQueries.all });
    },
  });
}
