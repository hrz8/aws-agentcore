import { parse as parseYaml } from 'yaml';
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

export function parseSkillMd(content: string): { frontmatter: SkillFrontmatter; body: string } {
  const normalised = content.replace(/\r\n/g, '\n');
  if (!normalised.startsWith('---\n')) {
    throw new SkillValidationError('SKILL.md missing leading frontmatter (---)');
  }
  const endIdx = normalised.indexOf('\n---\n', 4);
  if (endIdx < 0) {
    throw new SkillValidationError('SKILL.md frontmatter has no closing ---');
  }
  const yamlText = normalised.slice(4, endIdx);
  const body = normalised.slice(endIdx + 5);

  let raw: unknown;
  try {
    raw = parseYaml(yamlText);
  } catch (err) {
    throw new SkillValidationError(
      `SKILL.md frontmatter YAML parse failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const parsed = SkillFrontmatterSchema.safeParse(raw);
  if (!parsed.success) {
    throw new SkillValidationError(
      `SKILL.md frontmatter invalid: ${z.prettifyError(parsed.error)}`,
    );
  }
  return { frontmatter: parsed.data, body };
}

export class SkillValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkillValidationError';
  }
}
