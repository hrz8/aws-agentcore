import { s3ScopePath, type Scope } from '@repo/kit/identity';

export function skillsRootPrefixFor(scope: Scope): string {
  return `skills/${s3ScopePath(scope.tenantId, scope.agentId, scope.version)}/`;
}

export function skillPrefixFor(scope: Scope, name: string): string {
  return `${skillsRootPrefixFor(scope)}${name}/`;
}

export function skillMdKeyFor(scope: Scope, name: string): string {
  return `${skillPrefixFor(scope, name)}SKILL.md`;
}

export function skillSidecarKeyFor(scope: Scope, name: string): string {
  return `${skillMdKeyFor(scope, name)}.metadata.json`;
}

export function guessContentType(rel: string): string {
  const ext = rel.toLowerCase().split('.').pop() ?? '';
  switch (ext) {
    case 'md': return 'text/markdown';
    case 'json': return 'application/json';
    case 'yaml':
    case 'yml': return 'application/yaml';
    case 'txt': return 'text/plain';
    case 'csv': return 'text/csv';
    case 'sh': return 'text/x-shellscript';
    case 'py': return 'text/x-python';
    case 'js': return 'text/javascript';
    case 'ts': return 'text/x-typescript';
    case 'html': return 'text/html';
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'svg': return 'image/svg+xml';
    default: return 'application/octet-stream';
  }
}
