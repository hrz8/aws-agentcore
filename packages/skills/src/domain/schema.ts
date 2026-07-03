import { z } from 'zod';

export const SKILL_NAME_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export const SkillFrontmatterSchema = z.object({
  name: z.string().min(1).max(64).regex(SKILL_NAME_REGEX, 'invalid skill name'),
  description: z.string().min(1).max(1024),
  'allowed-tools': z.string().optional(),
  license: z.string().optional(),
  compatibility: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;
