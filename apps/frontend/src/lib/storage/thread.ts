import type { Scope } from './scope';

const THREAD_KEY_PREFIX = 'agui-thread-id';

function threadKeyFor(scope: Scope | null): string {
  if (!scope) return THREAD_KEY_PREFIX;
  return `${THREAD_KEY_PREFIX}::${scope.tenantId}::${scope.agentId}::${scope.agentVersion}`;
}

export function loadOrMintThreadId(scope: Scope | null): string {
  const key = threadKeyFor(scope);
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export function mintThreadId(scope: Scope | null): string {
  const key = threadKeyFor(scope);
  const id = crypto.randomUUID();
  localStorage.setItem(key, id);
  return id;
}
