import type { Scope } from '@repo/kit/identity';

import { KbScopeError } from '../errors.js';

export function assertS3UriInScope(bucket: string, scope: Scope, uri: string): void {
  const allowedPrefix = `s3://${bucket}/kb/${scope.tenantId}/${scope.agentId}/${scope.version}/`;
  if (!uri.startsWith(allowedPrefix)) {
    throw new KbScopeError('uri not in this scope');
  }
}

export function assertS3KeyInScope(scope: Scope, key: string): void {
  const allowedPrefix = `kb/${scope.tenantId}/${scope.agentId}/${scope.version}/`;
  if (!key.startsWith(allowedPrefix)) {
    throw new KbScopeError('key not in this scope');
  }
}

export function assertWebDocIdInScope(scope: Scope, docId: string): void {
  const prefix = `${scope.tenantId}__${scope.agentId}__${scope.version}__`;
  if (!docId.startsWith(prefix)) {
    throw new KbScopeError('docId not in this scope');
  }
}
