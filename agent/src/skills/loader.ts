import { Skill } from '@strands-agents/sdk/vended-plugins/skills';

import { type AgentScopeConfig, composeAgentScope } from '../config.js';
import { getObjectText, listCommonPrefixes, listObjects } from '../utils/aws/s3/client.js';

export type LoadedSkill = {
  skill: Skill;
  resources: string[];
};

export async function loadSkillsFromS3(scope: AgentScopeConfig): Promise<LoadedSkill[]> {
  const prefix = `skills/${composeAgentScope(scope.tenantId, scope.agentId)}/`;
  const skillDirs = await listCommonPrefixes(scope.uploadsBucket, prefix);

  const results = await Promise.all(skillDirs.map(async (skillPrefix) => {
    const name = skillPrefix.slice(prefix.length, -1);
    try {
      const [skillMd, files] = await Promise.all([
        getObjectText(scope.uploadsBucket, `${skillPrefix}SKILL.md`),
        listObjects(scope.uploadsBucket, skillPrefix),
      ]);
      const skill = Skill.fromContent(skillMd);
      const resources = files
        .map(f => f.key.slice(skillPrefix.length))
        .filter(r => r !== ''
          && r !== 'SKILL.md'
          && r !== 'SKILL.md.metadata.json'
          && (r.startsWith('references/') || r.startsWith('assets/')));
      return { skill, resources };
    } catch (err) {
      console.warn(`[skills] failed to load ${name}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }));

  return results.filter((r): r is LoadedSkill => r !== null);
}
