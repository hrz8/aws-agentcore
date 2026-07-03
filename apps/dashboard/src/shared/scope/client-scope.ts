import { AppError, ErrorCode } from '../errors';
import type { WireScope } from './schema';

// tenantId stays client-side for query-key stability across slug renames; only slug crosses the wire.
export type ResolvedScope = {
  tenantId: string;
  tenantSlug: string;
  agentId: string;
  agentVersion: string;
};

export function toWireScope(scope: ResolvedScope): WireScope {
  return {
    tenantSlug: scope.tenantSlug,
    agentId: scope.agentId,
    version: scope.agentVersion,
  };
}

export function requireScope(scope: ResolvedScope | null): ResolvedScope {
  if (!scope) {
    throw new AppError(ErrorCode.NoTenantSelected, { message: 'no scope selected' });
  }
  return scope;
}
