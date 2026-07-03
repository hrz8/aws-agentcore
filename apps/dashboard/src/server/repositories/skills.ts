import { S3SkillsRepository, type SkillsRepository } from '@repo/skills';

import { getLogger } from '@repo/kit/logger';

import { AWS_REGION, SKILLS_STAGE } from '#/server/config';

// Lazy singleton — same shape as getKbRepo.
let skillsSingleton: SkillsRepository | null = null;

export function getSkillsRepo(): SkillsRepository {
  if (skillsSingleton) {
    return skillsSingleton;
  }
  if (!SKILLS_STAGE) {
    throw new Error('Skills stage not configured');
  }
  skillsSingleton = new S3SkillsRepository({
    region: AWS_REGION,
    uploadsBucket: SKILLS_STAGE.uploadsBucket,
    logger: getLogger().child({ context: 'skills' }),
  });
  return skillsSingleton;
}
