export const METADATA_KEYS = Object.freeze({
  tenantId: 'tenant_id',
  agentId: 'agent_id',
  agentVersion: 'agent_version',
  skillName: 'skill_name',
  sourceUrl: 'source_url',
  title: 'title',
  fetchedAt: 'fetched_at',
} as const);

export type MetadataKey = keyof typeof METADATA_KEYS;

export function rewriteAgentVersion(sidecarJson: string, targetVersion: string): string {
  const parsed = JSON.parse(sidecarJson) as {
    metadataAttributes?: Record<string, string>;
    [k: string]: unknown;
  };
  const attrs = { ...(parsed.metadataAttributes ?? {}), [METADATA_KEYS.agentVersion]: targetVersion };
  return JSON.stringify({ ...parsed, metadataAttributes: attrs });
}
