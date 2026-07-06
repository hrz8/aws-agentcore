import { MIDDLEWARE_URL } from '../env';
import { getJson, HttpError } from './http';
import type { Scope } from './storage/scope';

export type ScopeDetails = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  agentId: string;
  agentSlug: string;
  agentVersion: string;
};

export type ScopeLookupResult =
  | { kind: 'ok'; details: ScopeDetails }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string };

export async function fetchScopeDetails(
  scope: Scope,
  signal?: AbortSignal,
): Promise<ScopeLookupResult> {
  const url =
    `${MIDDLEWARE_URL}/scope`
    + `?tenant=${encodeURIComponent(scope.tenantId)}`
    + `&agent=${encodeURIComponent(scope.agentId)}`
    + `&version=${encodeURIComponent(scope.agentVersion)}`;
  try {
    const details = await getJson<ScopeDetails>(url, { signal });
    return { kind: 'ok', details };
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) {
      return { kind: 'not-found' };
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    return {
      kind: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
