export type Scope = {
  readonly tenantId: string;
  readonly agentId: string;
  readonly version: string;
};

export function composeAgentScope(tenantId: string, agentId: string, version: string): string {
  return `${tenantId}__${agentId}__${version}`;
}

export function s3ScopePath(tenantId: string, agentId: string, version: string): string {
  return `${tenantId}__${agentId}/${version}`;
}
