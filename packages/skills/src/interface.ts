import type { Scope } from '@repo/kit/identity';
import type { Logger } from '@repo/kit/logger';

import type {
  SignedResourceUrl,
  SkillBranchOutcome,
  SkillContent,
  SkillDetail,
  SkillSource,
  SkillSummary,
} from './domain/index.js';

export type SkillsRepositoryOptions = {
  logger?: Logger;
};

export type SignResourceInput = {
  scope: Scope;
  name: string;
  path: string;
  ttlSeconds?: number;
};

export type BranchInput = {
  scope: Scope;
  toVersion: string;
};

export interface SkillsRepository {
  list(scope: Scope): Promise<SkillSummary[]>;
  get(scope: Scope, name: string): Promise<SkillDetail>;
  getContent(scope: Scope, name: string): Promise<SkillContent>;
  install(scope: Scope, source: SkillSource): Promise<SkillSummary>;
  remove(scope: Scope, name: string): Promise<void>;
  signResource(input: SignResourceInput): Promise<SignedResourceUrl>;
  branch(input: BranchInput): Promise<SkillBranchOutcome>;
}
