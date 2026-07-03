import type { Scope } from '@repo/kit/identity';
import type { Logger } from '@repo/kit/logger';
import { METADATA_KEYS, rewriteAgentVersion } from '@repo/kit/paths';
import {
  copyObject,
  createS3Client,
  deletePrefix,
  getObjectText,
  listCommonPrefixes,
  listObjects,
  NoSuchKey,
  presignGetObject,
  putObject,
  type S3Client,
} from '@repo/kit/aws/s3';

import {
  assertResourcePath,
  assertSkillName,
  SIGNABLE_RESOURCE_REGEX,
} from '../../domain/resource-path.js';
import { SKILL_NAME_REGEX } from '../../domain/schema.js';
import {
  SkillSourceKind,
  type SignedResourceUrl,
  type SkillBranchOutcome,
  type SkillContent,
  type SkillDetail,
  type SkillSource,
  type SkillSummary,
} from '../../domain/types.js';
import {
  SkillNotFoundError,
  SkillValidationError,
} from '../../errors.js';
import { parseSkillMd } from '../../format/skill-md.js';
import { extractSkillZip } from '../../format/zip-extract.js';
import type {
  BranchInput,
  SignResourceInput,
  SkillsRepository,
  SkillsRepositoryOptions,
} from '../../interface.js';

import {
  guessContentType,
  skillMdKeyFor,
  skillPrefixFor,
  skillSidecarKeyFor,
  skillsRootPrefixFor,
} from './paths.js';

export {
  guessContentType,
  skillMdKeyFor,
  skillPrefixFor,
  skillSidecarKeyFor,
  skillsRootPrefixFor,
} from './paths.js';

const DEFAULT_SIGN_TTL_S = 5 * 60;

export type S3SkillsRepositoryOptions = SkillsRepositoryOptions & {
  region: string;
  uploadsBucket: string;
};

export class S3SkillsRepository implements SkillsRepository {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly log: Logger | undefined;

  constructor(opts: S3SkillsRepositoryOptions) {
    this.s3 = createS3Client(opts.region);
    this.bucket = opts.uploadsBucket;
    this.log = opts.logger;
  }

  async install(scope: Scope, source: SkillSource): Promise<SkillSummary> {
    if (source.kind === SkillSourceKind.SkillMd) {
      const text = Buffer.from(source.bytes).toString('utf-8');
      const { frontmatter } = parseSkillMd(text);
      await this.writeSkill(scope, frontmatter.name, text, new Map());
      this.log?.info('skills.install', {
        source: source.kind,
        skill: frontmatter.name,
        tenantId: scope.tenantId,
        agentId: scope.agentId,
        version: scope.version,
      });
      return { name: frontmatter.name, description: frontmatter.description };
    }
    const extracted = extractSkillZip(Buffer.from(source.bytes));
    await this.writeSkill(
      scope,
      extracted.frontmatter.name,
      extracted.skillMd,
      extracted.resources,
    );
    this.log?.info('skills.install', {
      source: source.kind,
      skill: extracted.frontmatter.name,
      resourceCount: extracted.resources.size,
      tenantId: scope.tenantId,
      agentId: scope.agentId,
      version: scope.version,
    });
    return {
      name: extracted.frontmatter.name,
      description: extracted.frontmatter.description,
    };
  }

  private async writeSkill(
    scope: Scope,
    name: string,
    skillMd: string,
    resources: Map<string, Buffer>,
  ): Promise<void> {
    const skillDir = skillPrefixFor(scope, name);
    await deletePrefix(this.s3, this.bucket, skillDir);
    await Promise.all([
      putObject(this.s3, {
        bucket: this.bucket,
        key: skillMdKeyFor(scope, name),
        body: skillMd,
        contentType: 'text/markdown',
      }),
      putObject(this.s3, {
        bucket: this.bucket,
        key: skillSidecarKeyFor(scope, name),
        body: JSON.stringify({
          metadataAttributes: {
            [METADATA_KEYS.tenantId]: scope.tenantId,
            [METADATA_KEYS.agentId]: scope.agentId,
            [METADATA_KEYS.agentVersion]: scope.version,
            [METADATA_KEYS.skillName]: name,
          },
        }),
        contentType: 'application/json',
      }),
      ...[...resources.entries()].map(([rel, dataBuf]) =>
        putObject(this.s3, {
          bucket: this.bucket,
          key: `${skillDir}${rel}`,
          body: dataBuf,
          contentType: guessContentType(rel),
        }),
      ),
    ]);
  }

  async list(scope: Scope): Promise<SkillSummary[]> {
    const rootPrefix = skillsRootPrefixFor(scope);
    const prefixes = await listCommonPrefixes(this.s3, this.bucket, rootPrefix);
    const skills = await Promise.all(
      prefixes.map(async (p) => {
        const name = p.slice(rootPrefix.length, -1);
        if (!SKILL_NAME_REGEX.test(name)) return null;
        try {
          const text = await getObjectText(this.s3, this.bucket, skillMdKeyFor(scope, name));
          const { frontmatter } = parseSkillMd(text);
          return { name: frontmatter.name, description: frontmatter.description };
        } catch (err) {
          this.log?.warn('skills.list.item-failed', {
            name,
            err: err instanceof Error ? err.message : String(err),
          });
          return { name, description: '(SKILL.md missing or invalid)' };
        }
      }),
    );
    return skills.filter((s): s is SkillSummary => s !== null);
  }

  async get(scope: Scope, name: string): Promise<SkillDetail> {
    assertSkillName(name);
    let skillMd: string;
    let files: Awaited<ReturnType<typeof listObjects>>;
    try {
      [skillMd, files] = await Promise.all([
        getObjectText(this.s3, this.bucket, skillMdKeyFor(scope, name)),
        listObjects(this.s3, this.bucket, skillPrefixFor(scope, name)),
      ]);
    } catch (err) {
      if (this.isMissingKey(err)) {
        throw new SkillNotFoundError(name);
      }
      throw err;
    }
    const { frontmatter, body } = parseSkillMd(skillMd);
    const resources = files
      .map((f) => f.key.slice(skillPrefixFor(scope, name).length))
      .filter((rel) => rel !== 'SKILL.md' && rel !== 'SKILL.md.metadata.json' && rel !== '');
    return {
      name: frontmatter.name,
      description: frontmatter.description,
      allowedTools: frontmatter['allowed-tools']?.split(/\s+/).filter(Boolean) ?? [],
      license: frontmatter.license ?? null,
      compatibility: frontmatter.compatibility ?? null,
      instructions: body,
      resources,
    };
  }

  async getContent(scope: Scope, name: string): Promise<SkillContent> {
    assertSkillName(name);
    let skillMd: string;
    let files: Awaited<ReturnType<typeof listObjects>>;
    try {
      [skillMd, files] = await Promise.all([
        getObjectText(this.s3, this.bucket, skillMdKeyFor(scope, name)),
        listObjects(this.s3, this.bucket, skillPrefixFor(scope, name)),
      ]);
    } catch (err) {
      if (this.isMissingKey(err)) {
        throw new SkillNotFoundError(name);
      }
      throw err;
    }
    const resources = files
      .map((f) => f.key.slice(skillPrefixFor(scope, name).length))
      .filter((rel) => SIGNABLE_RESOURCE_REGEX.test(rel));
    return { skillMd, resources };
  }

  async remove(scope: Scope, name: string): Promise<void> {
    assertSkillName(name);
    const deleted = await deletePrefix(this.s3, this.bucket, skillPrefixFor(scope, name));
    if (deleted === 0) {
      throw new SkillNotFoundError(name);
    }
  }

  async signResource(input: SignResourceInput): Promise<SignedResourceUrl> {
    const ttl = input.ttlSeconds ?? DEFAULT_SIGN_TTL_S;
    assertResourcePath(input.name, input.path);
    const key = `${skillPrefixFor(input.scope, input.name)}${input.path}`;
    const url = await presignGetObject(this.s3, this.bucket, key, ttl, 'inline');
    return { url, expiresIn: ttl };
  }

  async branch(input: BranchInput): Promise<SkillBranchOutcome> {
    if (input.toVersion === input.scope.version) {
      throw new SkillValidationError(`target version equals source (${input.toVersion})`);
    }
    const targetScope: Scope = { ...input.scope, version: input.toVersion };
    const sourcePrefix = skillsRootPrefixFor(input.scope);
    const targetPrefix = skillsRootPrefixFor(targetScope);

    const existingAtTarget = await listObjects(this.s3, this.bucket, targetPrefix);
    if (existingAtTarget.length > 0) {
      throw new SkillValidationError(
        `target prefix ${targetPrefix} is not empty (${existingAtTarget.length} objects).`,
      );
    }
    const sourceObjects = await listObjects(this.s3, this.bucket, sourcePrefix);
    if (sourceObjects.length === 0) {
      throw new SkillValidationError(`no objects under source prefix ${sourcePrefix}`);
    }

    let filesCopied = 0;
    let sidecarsRewritten = 0;
    for (const obj of sourceObjects) {
      const rel = obj.key.slice(sourcePrefix.length);
      const targetKey = `${targetPrefix}${rel}`;
      if (obj.key.endsWith('.metadata.json')) {
        const raw = await getObjectText(this.s3, this.bucket, obj.key);
        const rewritten = rewriteAgentVersion(raw, input.toVersion);
        await putObject(this.s3, {
          bucket: this.bucket,
          key: targetKey,
          body: rewritten,
          contentType: 'application/json',
        });
        sidecarsRewritten += 1;
      } else {
        await copyObject(this.s3, this.bucket, obj.key, targetKey);
      }
      filesCopied += 1;
    }
    this.log?.info('skills.branch', {
      sourceVersion: input.scope.version,
      targetVersion: input.toVersion,
      filesCopied,
      sidecarsRewritten,
    });
    return {
      sourceVersion: input.scope.version,
      targetVersion: input.toVersion,
      filesCopied,
      sidecarsRewritten,
      sourcePrefix,
      targetPrefix,
    };
  }

  private isMissingKey(err: unknown): boolean {
    return err instanceof NoSuchKey;
  }
}
