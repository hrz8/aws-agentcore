import type { Tool } from '@strands-agents/sdk';
import { AgentSkills } from '@strands-agents/sdk/vended-plugins/skills';

import type { Scope } from '@repo/kit/identity';
import { createReadSkillResourceTool } from '../tools/read_skill_resource/index.js';
import { loadSkillsFromS3 } from './loader.js';
import { createSkillsRefresher, type ResourceMapRef } from './refresh.js';

export type SkillsWiring = {
  tools: Tool[];
  plugin: AgentSkills | undefined;
  refreshSkillsIfStale: () => Promise<void>;
};

export type WireSkillsOptions = {
  scope: Scope;
  uploadsBucket: string | null;
};

export async function wireSkills(opts: WireSkillsOptions): Promise<SkillsWiring> {
  if (!opts.uploadsBucket) {
    return {
      tools: [],
      plugin: undefined,
      refreshSkillsIfStale: async () => {},
    };
  }

  const loaded = await safeLoadSkillsFromS3(opts.scope, opts.uploadsBucket);

  const plugin = new AgentSkills({ skills: loaded.map(l => l.skill) });

  const resourceMapRef: ResourceMapRef = new Map();
  for (const { skill, resources } of loaded) {
    resourceMapRef.set(skill.name, new Set(resources));
  }

  const tools: Tool[] = [
    ...plugin.getTools(),
    createReadSkillResourceTool({
      resourceMapRef,
      scope: opts.scope,
      uploadsBucket: opts.uploadsBucket,
    }),
  ];

  const refreshSkillsIfStale = createSkillsRefresher({
    plugin,
    resourceMapRef,
    scope: opts.scope,
    uploadsBucket: opts.uploadsBucket,
  });

  return {
    tools,
    plugin,
    refreshSkillsIfStale,
  };
}

async function safeLoadSkillsFromS3(scope: Scope, uploadsBucket: string) {
  try {
    const loaded = await loadSkillsFromS3({ scope, uploadsBucket });
    console.info(
      `[agent] loaded ${loaded.length} skill(s) from S3 for ${scope.tenantId}/${scope.agentId}/${scope.version}`,
    );
    return loaded;
  } catch (err) {
    console.warn(
      `[agent] skill load failed for ${scope.tenantId}/${scope.agentId}/${scope.version}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
}
