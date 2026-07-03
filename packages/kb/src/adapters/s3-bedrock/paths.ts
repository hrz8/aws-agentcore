import { s3ScopePath, type Scope } from '@repo/kit/identity';

export function kbPrefixFor(scope: Scope): string {
  return `kb/${s3ScopePath(scope.tenantId, scope.agentId, scope.version)}/`;
}

export function webDocIdPrefix(scope: Scope): string {
  return `${scope.tenantId}__${scope.agentId}__${scope.version}__`;
}

export function composeWebDocId(scope: Scope, contentHash: string): string {
  return `${webDocIdPrefix(scope)}${contentHash}`;
}

export function sanitizeFilename(name: string): string | null {
  const base = name.replace(/^.*[\\/]/, '').trim();
  if (!base || base === '.' || base === '..') {
    return null;
  }
  if (/[\x00-\x1F\x7F]/.test(base)) {
    return null;
  }
  return base;
}
