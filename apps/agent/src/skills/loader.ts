import { Skill } from '@strands-agents/sdk/vended-plugins/skills';

import type { Scope } from '@repo/kit/identity';
import { getLogger } from '@repo/kit/logger';
import { S3SkillsRepository } from '@repo/skills';

export type LoadedSkill = {
  skill: Skill;
  resources: string[];
};

export type LoadSkillsOptions = {
  scope: Scope;
  uploadsBucket: string;
  region?: string;
};

const REPO_CACHE = new Map<string, S3SkillsRepository>();

function getRepo(opts: LoadSkillsOptions): S3SkillsRepository {
  const region = opts.region ?? process.env['AWS_REGION'] ?? 'us-east-1';
  const key = `${region}\x00${opts.uploadsBucket}`;
  const cached = REPO_CACHE.get(key);
  if (cached) return cached;
  const repo = new S3SkillsRepository({
    region,
    uploadsBucket: opts.uploadsBucket,
    logger: getLogger().child({ context: 'skills.loader' }),
  });
  REPO_CACHE.set(key, repo);
  return repo;
}

export async function loadSkillsFromS3(opts: LoadSkillsOptions): Promise<LoadedSkill[]> {
  const log = getLogger().child({ context: 'skills.loader' });
  const repo = getRepo(opts);

  const summaries = await repo.list(opts.scope);
  const results = await Promise.all(
    summaries.map(async ({ name }) => {
      try {
        const content = await repo.getContent(opts.scope, name);
        const skill = Skill.fromContent(content.skillMd);
        return { skill, resources: content.resources } satisfies LoadedSkill;
      } catch (err) {
        log.warn('skills.load-failed', {
          name,
          err: err instanceof Error ? err.message : String(err),
        });
        return null;
      }
    }),
  );

  return results.filter((r): r is LoadedSkill => r !== null);
}
