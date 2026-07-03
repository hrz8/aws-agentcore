import { isUuid } from '@repo/kit/identity';

const SCOPE_KEY = 'agentcore-scope';

export type Scope = {
  tenantId: string;
  agentId: string;
  agentVersion: string;
};

export function loadScope(): Scope | null {
  try {
    const raw = sessionStorage.getItem(SCOPE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed && typeof parsed === 'object'
      && typeof (parsed as Scope).tenantId === 'string' && isUuid((parsed as Scope).tenantId)
      && typeof (parsed as Scope).agentId === 'string' && isUuid((parsed as Scope).agentId)
      && typeof (parsed as Scope).agentVersion === 'string'
    ) {
      return parsed as Scope;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveScope(scope: Scope): void {
  sessionStorage.setItem(SCOPE_KEY, JSON.stringify(scope));
}

export function clearScope(): void {
  sessionStorage.removeItem(SCOPE_KEY);
}

export function adoptScopeFromUrl(): Scope | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  const tenantId = params.get('tenant');
  const agentId = params.get('agent');
  const agentVersion = params.get('version');
  if (!tenantId || !agentId || !agentVersion) {
    return null;
  }
  if (!isUuid(tenantId) || !isUuid(agentId)) {
    return null;
  }
  const scope: Scope = {
    tenantId,
    agentId,
    agentVersion,
  };
  saveScope(scope);
  return scope;
}
