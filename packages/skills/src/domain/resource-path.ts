import { SkillPathError, SkillValidationError } from '../errors.js';

import { SKILL_NAME_REGEX } from './schema.js';

// scripts/ deliberately excluded: agent-runtime-only, must not be signable.
export const SIGNABLE_RESOURCE_REGEX = /^(references|assets)\//;

export function assertSkillName(name: string): void {
  if (!SKILL_NAME_REGEX.test(name)) {
    throw new SkillValidationError('invalid skill name');
  }
}

export function assertResourcePath(name: string, path: string): void {
  assertSkillName(name);
  if (!SIGNABLE_RESOURCE_REGEX.test(path)) {
    throw new SkillPathError('only references/ and assets/ are accessible');
  }
  if (path.split('/').some((seg) => seg === '..')) {
    throw new SkillPathError('path traversal rejected');
  }
  if (path.startsWith('/')) {
    throw new SkillPathError('absolute paths rejected');
  }
  if (path.includes('\\')) {
    throw new SkillPathError('backslash paths rejected');
  }
}
