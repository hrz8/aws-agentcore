import type { Agent } from '@strands-agents/sdk';
import type { AgentSkills } from '@strands-agents/sdk/vended-plugins/skills';

export type CreatedAgent = {
  agent: Agent;
  refreshSkillsIfStale: () => Promise<void>;
  skillsPlugin: AgentSkills | undefined;
};
