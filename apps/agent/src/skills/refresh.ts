import type { AgentSkills } from '@strands-agents/sdk/vended-plugins/skills';

import type { Scope } from '@repo/kit/identity';
import { loadSkillsFromS3 } from './loader.js';

const SKILLS_REFRESH_TTL_MS = 120_000;

export type ResourceMapRef = Map<string, Set<string>>;

export type RefreshDeps = {
  plugin: AgentSkills;
  resourceMapRef: ResourceMapRef;
  scope: Scope;
  uploadsBucket: string;
};


// TTL-gated refresh closure
export function createSkillsRefresher(deps: RefreshDeps): () => Promise<void> {
  let lastRefreshedAt = Date.now();
  let inFlight: Promise<void> | null = null;

  return async function refreshSkillsIfStale(): Promise<void> {
    if (Date.now() - lastRefreshedAt < SKILLS_REFRESH_TTL_MS) return;
    if (inFlight) return inFlight;

    inFlight = (async () => {
      try {
        const prevCount = deps.resourceMapRef.size;
        const loaded = await loadSkillsFromS3({ scope: deps.scope, uploadsBucket: deps.uploadsBucket });
        deps.plugin.setAvailableSkills(loaded.map(l => l.skill));
        deps.resourceMapRef.clear();
        for (const { skill, resources } of loaded) {
          deps.resourceMapRef.set(skill.name, new Set(resources));
        }
        lastRefreshedAt = Date.now();
        console.info(
          `[agent] skills refreshed (${deps.scope.tenantId}/${deps.scope.agentId}/${deps.scope.version}): ${prevCount} -> ${loaded.length}`,
        );
      } catch (err) {
        console.warn(
          `[agent] skill refresh failed (${deps.scope.tenantId}/${deps.scope.agentId}/${deps.scope.version}): ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  };
}
