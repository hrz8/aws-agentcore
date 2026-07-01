import { Agent } from '@strands-agents/sdk';

import { AGENT_SCOPE } from '../config.js';
import { loadModel } from '../models/index.js';
import { wireSkills } from '../skills/wire.js';
import { buildBaseTools } from '../tools/base.js';
import { convertTemperatureTool } from '../tools/temperature.js';
import type { CreatedAgent } from './types.js';

const SIMPLE_AGENT_SYSTEM_PROMPT = `You are a helpful assistant. Keep replies concise and friendly.

When the user asks to convert a temperature between Celsius and Fahrenheit, use the convert_temperature tool — do not compute it from memory.

When the user asks about something that might be in their uploaded documents (contracts, notes, manuals, policies, reports, anything they've shared), use the search_documents tool to find relevant passages, then answer from those passages and cite the source file. If search_documents returns no results, say so plainly rather than guessing.

When the user asks about something that might be on the websites we've indexed, use the search_web tool. Cite the source URL. If search_web returns no results, say so plainly.

Skills (available_skills below, if any) carry on-demand instructions for specialised tasks. IMPORTANT: When a user request matches a skill's description, you MUST call the \`skills\` tool with the skill name FIRST to load its full instructions, BEFORE calling any other tool and BEFORE composing your answer. The description in the XML is only a routing hint — the actual instructions live inside the skill body and can contain specific phrasings, procedures, or constraints you cannot infer from the description. Only after loading the skill body should you optionally use \`read_skill_resource\` to fetch reference files.`;

export async function createSimpleAgent(): Promise<CreatedAgent> {
  const baseTools = buildBaseTools();
  const skills = await wireSkills(AGENT_SCOPE);

  const agent = new Agent({
    model: loadModel(),
    systemPrompt: SIMPLE_AGENT_SYSTEM_PROMPT,
    tools: [convertTemperatureTool, ...baseTools, ...skills.tools],
  });

  return {
    agent,
    refreshSkillsIfStale: skills.refreshSkillsIfStale,
    skillsPlugin: skills.plugin,
  };
}
