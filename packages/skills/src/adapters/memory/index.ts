import type { Scope } from '@repo/kit/identity';

import {
  assertResourcePath,
  assertSkillName,
  SIGNABLE_RESOURCE_REGEX,
} from '../../domain/resource-path.js';
import type { SkillFrontmatter } from '../../domain/schema.js';
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
} from '../../interface.js';

type StoredSkill = {
  skillMd: string;
  detail: SkillDetail;
  resources: Map<string, Uint8Array>;
};

function keyOf(scope: Scope, name: string): string {
  return `${scope.tenantId}/${scope.agentId}/${scope.version}/${name}`;
}
function scopePrefixOf(scope: Scope): string {
  return `${scope.tenantId}/${scope.agentId}/${scope.version}/`;
}

export class MemorySkillsRepository implements SkillsRepository {
  private readonly store = new Map<string, StoredSkill>();

  async install(scope: Scope, source: SkillSource): Promise<SkillSummary> {
    if (source.kind === SkillSourceKind.SkillMd) {
      const text = Buffer.from(source.bytes).toString('utf-8');
      const { frontmatter, body } = parseSkillMd(text);
      this.write(scope, text, body, frontmatter, new Map());
      return { name: frontmatter.name, description: frontmatter.description };
    }
    const extracted = extractSkillZip(Buffer.from(source.bytes));
    const { frontmatter, skillMd, resources } = extracted;
    const { body } = parseSkillMd(skillMd);
    const resourceBytes = new Map<string, Uint8Array>();
    for (const [rel, buf] of resources) {
      resourceBytes.set(rel, new Uint8Array(buf));
    }
    this.write(scope, skillMd, body, frontmatter, resourceBytes);
    return { name: frontmatter.name, description: frontmatter.description };
  }

  private write(
    scope: Scope,
    skillMd: string,
    body: string,
    frontmatter: SkillFrontmatter,
    resources: Map<string, Uint8Array>,
  ): void {
    this.store.set(keyOf(scope, frontmatter.name), {
      skillMd,
      detail: {
        name: frontmatter.name,
        description: frontmatter.description,
        allowedTools: frontmatter['allowed-tools']?.split(/\s+/).filter(Boolean) ?? [],
        license: frontmatter.license ?? null,
        compatibility: frontmatter.compatibility ?? null,
        instructions: body,
        resources: [...resources.keys()],
      },
      resources,
    });
  }

  async list(scope: Scope): Promise<SkillSummary[]> {
    const prefix = scopePrefixOf(scope);
    const summaries: SkillSummary[] = [];
    for (const [key, entry] of this.store) {
      if (!key.startsWith(prefix)) {
        continue;
      }
      summaries.push({ name: entry.detail.name, description: entry.detail.description });
    }
    return summaries;
  }

  async get(scope: Scope, name: string): Promise<SkillDetail> {
    assertSkillName(name);
    const found = this.store.get(keyOf(scope, name));
    if (!found) {
      throw new SkillNotFoundError(name);
    }
    return found.detail;
  }

  async getContent(scope: Scope, name: string): Promise<SkillContent> {
    assertSkillName(name);
    const found = this.store.get(keyOf(scope, name));
    if (!found) {
      throw new SkillNotFoundError(name);
    }
    return {
      skillMd: found.skillMd,
      resources: [...found.resources.keys()].filter((rel) => SIGNABLE_RESOURCE_REGEX.test(rel)),
    };
  }

  async remove(scope: Scope, name: string): Promise<void> {
    assertSkillName(name);
    const key = keyOf(scope, name);
    if (!this.store.has(key)) {
      throw new SkillNotFoundError(name);
    }
    this.store.delete(key);
  }

  async signResource(input: SignResourceInput): Promise<SignedResourceUrl> {
    assertResourcePath(input.name, input.path);
    return {
      url: `memory://${input.scope.tenantId}/${input.scope.agentId}/${input.scope.version}/${input.name}/${input.path}`,
      expiresIn: input.ttlSeconds ?? 300,
    };
  }

  async branch(input: BranchInput): Promise<SkillBranchOutcome> {
    if (input.toVersion === input.scope.version) {
      throw new SkillValidationError(`target version equals source (${input.toVersion})`);
    }
    const sourcePrefix = scopePrefixOf(input.scope);
    const targetPrefix = scopePrefixOf({ ...input.scope, version: input.toVersion });

    for (const key of this.store.keys()) {
      if (key.startsWith(targetPrefix)) {
        throw new SkillValidationError(
          `target prefix ${targetPrefix} is not empty`,
        );
      }
    }
    let filesCopied = 0;
    let sidecarsRewritten = 0;
    for (const [key, entry] of this.store) {
      if (!key.startsWith(sourcePrefix)) {
        continue;
      }
      const name = key.slice(sourcePrefix.length);
      this.store.set(`${targetPrefix}${name}`, {
        skillMd: entry.skillMd,
        detail: entry.detail,
        resources: new Map(entry.resources),
      });
      filesCopied += 2 + entry.resources.size;
      sidecarsRewritten += 1;
    }
    if (filesCopied === 0) {
      throw new SkillValidationError(`no objects under source prefix ${sourcePrefix}`);
    }
    return {
      sourceVersion: input.scope.version,
      targetVersion: input.toVersion,
      filesCopied,
      sidecarsRewritten,
      sourcePrefix,
      targetPrefix,
    };
  }
}
