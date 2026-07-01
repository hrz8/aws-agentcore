import { tool } from '@strands-agents/sdk';
import { z } from 'zod';

import { AGENT_SCOPE, composeAgentScope } from '../config.js';
import type { ResourceMapRef } from '../skills/refresh.js';
import { getObjectText } from '../utils/aws/s3/client.js';

const MAX_BYTES = 256 * 1024;

const InputSchema = z.object({
  skill_name: z
    .string()
    .min(1)
    .max(64)
    .describe('Name of the activated skill (must match a skill listed in <available_skills>).'),
  path: z
    .string()
    .min(1)
    .max(512)
    .describe('Relative path inside the skill (e.g. "references/api.md" or "assets/template.json"). Only references/ and assets/ are accessible.'),
});

const ResultSchema = z.object({
  skillName: z.string(),
  path: z.string(),
  content: z.string(),
  truncated: z.boolean(),
});

export type ReadSkillResourceResult = z.infer<typeof ResultSchema>;

export type CreateReadSkillResourceToolOptions = {
  resourceMapRef: ResourceMapRef;
};

export function createReadSkillResourceTool(opts: CreateReadSkillResourceToolOptions) {
  return tool({
    name: 'read_skill_resource',
    description:
      'Read a reference or asset file shipped with an activated skill. ' +
      'Use this after activating a skill via the `skills` tool when its instructions reference a resource file. ' +
      'Only references/* and assets/* paths are accessible; scripts/ is not.',
    inputSchema: InputSchema,
    callback: async (input): Promise<ReadSkillResourceResult> => {
      if (!AGENT_SCOPE) {
        throw new Error('skill resources unavailable: AGENT_SCOPE not configured');
      }
      const allowed = opts.resourceMapRef.get(input.skill_name);
      if (!allowed) {
        throw new Error(
          `unknown skill: ${input.skill_name}. Did you call the \`skills\` tool first?`,
        );
      }
      if (!allowed.has(input.path)) {
        throw new Error(
          `resource not in skill ${input.skill_name}: ${input.path}. Available: ${[...allowed].join(', ') || '(none)'}`,
        );
      }
      if (input.path.includes('..') || input.path.startsWith('/')) {
        throw new Error('path traversal rejected');
      }
      if (!input.path.startsWith('references/') && !input.path.startsWith('assets/')) {
        throw new Error('only references/ and assets/ are accessible');
      }

      const key = `skills/${composeAgentScope(AGENT_SCOPE.tenantId, AGENT_SCOPE.agentId)}/${input.skill_name}/${input.path}`;
      const content = await getObjectText(AGENT_SCOPE.uploadsBucket, key);
      if (content.length > MAX_BYTES) {
        return {
          skillName: input.skill_name,
          path: input.path,
          content: content.slice(0, MAX_BYTES),
          truncated: true,
        };
      }
      return {
        skillName: input.skill_name,
        path: input.path,
        content,
        truncated: false,
      };
    },
  });
}
