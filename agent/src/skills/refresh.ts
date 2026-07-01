import type { AgentSkills } from '@strands-agents/sdk/vended-plugins/skills';

import type { AgentScopeConfig } from '../config.js';
import { loadSkillsFromS3 } from './loader.js';

const SKILLS_REFRESH_TTL_MS = 120_000;

export type ResourceMapRef = Map<string, Set<string>>;

export type RefreshDeps = {
  plugin: AgentSkills;
  resourceMapRef: ResourceMapRef;
  scope: AgentScopeConfig;
};

export function createSkillsRefresher(deps: RefreshDeps): () => Promise<void> {
  let lastRefreshedAt = Date.now();
  let inFlight: Promise<void> | null = null;

  return async function refreshSkillsIfStale(): Promise<void> {
    if (Date.now() - lastRefreshedAt < SKILLS_REFRESH_TTL_MS) return;
    if (inFlight) return inFlight;

    inFlight = (async () => {
      try {
        const prevCount = deps.resourceMapRef.size;
        const loaded = await loadSkillsFromS3(deps.scope);
        deps.plugin.setAvailableSkills(loaded.map(l => l.skill));
        deps.resourceMapRef.clear();
        for (const { skill, resources } of loaded) {
          deps.resourceMapRef.set(skill.name, new Set(resources));
        }
        lastRefreshedAt = Date.now();
        console.info(`[agent] skills refreshed: ${prevCount} -> ${loaded.length}`);
      } catch (err) {
        console.warn(
          `[agent] skill refresh failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  };
}
