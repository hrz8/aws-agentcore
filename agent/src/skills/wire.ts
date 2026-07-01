import type { Tool } from '@strands-agents/sdk';
import { AgentSkills } from '@strands-agents/sdk/vended-plugins/skills';

import type { AgentScopeConfig } from '../config.js';
import { createReadSkillResourceTool } from '../tools/read-skill-resource.js';
import { loadSkillsFromS3 } from './loader.js';
import { createSkillsRefresher, type ResourceMapRef } from './refresh.js';

export type SkillsWiring = {
  tools: Tool[];
  plugin: AgentSkills | undefined;
  refreshSkillsIfStale: () => Promise<void>;
};

export async function wireSkills(scope: AgentScopeConfig | null): Promise<SkillsWiring> {
  if (!scope) {
    return { tools: [], plugin: undefined, refreshSkillsIfStale: async () => {} };
  }

  const loaded = await safeLoadSkillsFromS3(scope);

  const plugin = new AgentSkills({ skills: loaded.map(l => l.skill) });

  const resourceMapRef: ResourceMapRef = new Map();
  for (const { skill, resources } of loaded) {
    resourceMapRef.set(skill.name, new Set(resources));
  }

  const tools: Tool[] = [
    ...plugin.getTools(),
    createReadSkillResourceTool({ resourceMapRef }),
  ];

  const refreshSkillsIfStale = createSkillsRefresher({ plugin, resourceMapRef, scope });

  return { tools, plugin, refreshSkillsIfStale };
}

async function safeLoadSkillsFromS3(scope: AgentScopeConfig) {
  try {
    const loaded = await loadSkillsFromS3(scope);
    console.info(`[agent] loaded ${loaded.length} skill(s) from S3`);
    return loaded;
  } catch (err) {
    console.warn(
      `[agent] skill load failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
}
