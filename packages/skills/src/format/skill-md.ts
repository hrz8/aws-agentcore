import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

import {
  SkillFrontmatterSchema,
  type SkillFrontmatter,
} from '../domain/schema.js';
import { SkillValidationError } from '../errors.js';

export function parseSkillMd(content: string): {
  frontmatter: SkillFrontmatter;
  body: string;
} {
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
