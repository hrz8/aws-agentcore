import { describe, expect, it } from 'vitest';

import type { Scope } from '@repo/kit/identity';

import {
  SkillNotFoundError,
  SkillPathError,
  SkillValidationError,
} from '../errors.js';
import { SkillSourceKind } from '../domain/types.js';
import type { SkillsRepository } from '../interface.js';

export function runSkillsContract(
  adapterName: string,
  makeRepo: () => SkillsRepository,
): void {
  const scope: Scope = {
    tenantId: '00000000-0000-4000-8000-000000000001',
    agentId: '00000000-0000-4000-8000-000000000002',
    version: '1.0.0',
  };

  const skillMd = [
    '---',
    'name: hello',
    'description: says hi',
    '---',
    'Say hi to the user.',
    '',
  ].join('\n');

  const skillMdBytes = new TextEncoder().encode(skillMd);

  describe(`SkillsRepository contract [${adapterName}]`, () => {
    it('installs and lists a SKILL.md skill', async () => {
      const repo = makeRepo();
      const summary = await repo.install(scope, {
        kind: SkillSourceKind.SkillMd,
        bytes: skillMdBytes,
      });
      expect(summary.name).toBe('hello');
      expect(summary.description).toBe('says hi');
      const listed = await repo.list(scope);
      expect(listed).toEqual([{ name: 'hello', description: 'says hi' }]);
    });

    it('returns full detail from get()', async () => {
      const repo = makeRepo();
      await repo.install(scope, { kind: SkillSourceKind.SkillMd, bytes: skillMdBytes });
      const detail = await repo.get(scope, 'hello');
      expect(detail.name).toBe('hello');
      expect(detail.description).toBe('says hi');
      expect(detail.instructions.trim()).toBe('Say hi to the user.');
      expect(detail.resources).toEqual([]);
    });

    it('returns raw SKILL.md text from getContent()', async () => {
      const repo = makeRepo();
      await repo.install(scope, { kind: SkillSourceKind.SkillMd, bytes: skillMdBytes });
      const content = await repo.getContent(scope, 'hello');
      expect(content.skillMd).toContain('name: hello');
      expect(content.skillMd).toContain('Say hi to the user.');
      expect(content.resources).toEqual([]);
    });

    it('removes a skill and list is empty', async () => {
      const repo = makeRepo();
      await repo.install(scope, { kind: SkillSourceKind.SkillMd, bytes: skillMdBytes });
      await expect(repo.remove(scope, 'hello')).resolves.toBeUndefined();
      expect(await repo.list(scope)).toEqual([]);
    });

    it('remove() throws SkillNotFoundError for unknown name', async () => {
      const repo = makeRepo();
      await expect(repo.remove(scope, 'nope')).rejects.toBeInstanceOf(SkillNotFoundError);
    });

    it('get() throws SkillNotFoundError for unknown name', async () => {
      const repo = makeRepo();
      await expect(repo.get(scope, 'missing')).rejects.toBeInstanceOf(SkillNotFoundError);
    });

    it('getContent() throws SkillNotFoundError for unknown name', async () => {
      const repo = makeRepo();
      await expect(repo.getContent(scope, 'missing')).rejects.toBeInstanceOf(
        SkillNotFoundError,
      );
    });

    it('get() throws SkillValidationError for invalid name shape', async () => {
      const repo = makeRepo();
      await expect(repo.get(scope, 'Invalid_Name')).rejects.toBeInstanceOf(
        SkillValidationError,
      );
    });

    it('list() on empty scope returns []', async () => {
      const repo = makeRepo();
      expect(await repo.list(scope)).toEqual([]);
    });

    it('re-installing same name overwrites', async () => {
      const repo = makeRepo();
      await repo.install(scope, { kind: SkillSourceKind.SkillMd, bytes: skillMdBytes });
      const updated = [
        '---',
        'name: hello',
        'description: updated description',
        '---',
        'New body.',
        '',
      ].join('\n');
      await repo.install(scope, {
        kind: SkillSourceKind.SkillMd,
        bytes: new TextEncoder().encode(updated),
      });
      const listed = await repo.list(scope);
      expect(listed).toHaveLength(1);
      expect(listed[0]?.description).toBe('updated description');
    });

    it('signResource uses default TTL when unspecified', async () => {
      const repo = makeRepo();
      await repo.install(scope, { kind: SkillSourceKind.SkillMd, bytes: skillMdBytes });
      const signed = await repo.signResource({
        scope,
        name: 'hello',
        path: 'references/x.md',
      });
      expect(signed.expiresIn).toBeGreaterThan(0);
    });

    it('rejects invalid SKILL.md frontmatter', async () => {
      const repo = makeRepo();
      const bad = new TextEncoder().encode('no frontmatter here');
      await expect(
        repo.install(scope, { kind: SkillSourceKind.SkillMd, bytes: bad }),
      ).rejects.toBeInstanceOf(SkillValidationError);
    });

    it('signResource rejects path traversal', async () => {
      const repo = makeRepo();
      await repo.install(scope, { kind: SkillSourceKind.SkillMd, bytes: skillMdBytes });
      await expect(
        repo.signResource({ scope, name: 'hello', path: 'references/../etc/passwd' }),
      ).rejects.toBeInstanceOf(SkillPathError);
    });

    it('signResource rejects disallowed top-level dirs', async () => {
      const repo = makeRepo();
      await repo.install(scope, { kind: SkillSourceKind.SkillMd, bytes: skillMdBytes });
      await expect(
        repo.signResource({ scope, name: 'hello', path: 'scripts/run.sh' }),
      ).rejects.toBeInstanceOf(SkillPathError);
    });

    it('signResource rejects absolute paths', async () => {
      const repo = makeRepo();
      await repo.install(scope, { kind: SkillSourceKind.SkillMd, bytes: skillMdBytes });
      await expect(
        repo.signResource({ scope, name: 'hello', path: '/etc/passwd' }),
      ).rejects.toBeInstanceOf(SkillPathError);
    });

    it('signResource rejects backslash paths', async () => {
      const repo = makeRepo();
      await repo.install(scope, { kind: SkillSourceKind.SkillMd, bytes: skillMdBytes });
      await expect(
        repo.signResource({ scope, name: 'hello', path: 'references\\..\\etc' }),
      ).rejects.toBeInstanceOf(SkillPathError);
    });

    it('signResource rejects invalid skill name shape', async () => {
      const repo = makeRepo();
      await expect(
        repo.signResource({ scope, name: 'Invalid_Name', path: 'references/x.md' }),
      ).rejects.toBeInstanceOf(SkillValidationError);
    });

    it('updateSkillMd() writes the new body and updates the description', async () => {
      const repo = makeRepo();
      await repo.install(scope, { kind: SkillSourceKind.SkillMd, bytes: skillMdBytes });
      const updated = [
        '---',
        'name: hello',
        'description: updated description',
        '---',
        'Say something else.',
        '',
      ].join('\n');
      const summary = await repo.updateSkillMd(scope, 'hello', updated);
      expect(summary).toEqual({ name: 'hello', description: 'updated description' });
      const content = await repo.getContent(scope, 'hello');
      expect(content.skillMd).toContain('Say something else.');
      expect(content.skillMd).toContain('description: updated description');
    });

    it('updateSkillMd() rejects rename (frontmatter name mismatch)', async () => {
      const repo = makeRepo();
      await repo.install(scope, { kind: SkillSourceKind.SkillMd, bytes: skillMdBytes });
      const renamed = [
        '---',
        'name: goodbye',
        'description: says bye',
        '---',
        'Bye.',
        '',
      ].join('\n');
      await expect(repo.updateSkillMd(scope, 'hello', renamed)).rejects.toBeInstanceOf(
        SkillValidationError,
      );
    });

    it('updateSkillMd() throws SkillNotFoundError when skill does not exist', async () => {
      const repo = makeRepo();
      await expect(repo.updateSkillMd(scope, 'nope', skillMd)).rejects.toBeInstanceOf(
        SkillNotFoundError,
      );
    });

    it('updateSkillMd() rejects invalid SKILL.md frontmatter', async () => {
      const repo = makeRepo();
      await repo.install(scope, { kind: SkillSourceKind.SkillMd, bytes: skillMdBytes });
      await expect(
        repo.updateSkillMd(scope, 'hello', 'no frontmatter at all'),
      ).rejects.toBeInstanceOf(SkillValidationError);
    });

    it('branch copies to a new version', async () => {
      const repo = makeRepo();
      await repo.install(scope, { kind: SkillSourceKind.SkillMd, bytes: skillMdBytes });
      const outcome = await repo.branch({ scope, toVersion: '2.0.0' });
      expect(outcome.sourceVersion).toBe(scope.version);
      expect(outcome.targetVersion).toBe('2.0.0');
      expect(outcome.filesCopied).toBeGreaterThan(0);

      const listed = await repo.list({ ...scope, version: '2.0.0' });
      expect(listed).toHaveLength(1);
    });

    it('branch rejects same source and target version', async () => {
      const repo = makeRepo();
      await repo.install(scope, { kind: SkillSourceKind.SkillMd, bytes: skillMdBytes });
      await expect(
        repo.branch({ scope, toVersion: scope.version }),
      ).rejects.toBeInstanceOf(SkillValidationError);
    });

    it('branch rejects non-empty target version', async () => {
      const repo = makeRepo();
      const targetScope: Scope = { ...scope, version: '2.0.0' };
      await repo.install(scope, { kind: SkillSourceKind.SkillMd, bytes: skillMdBytes });
      await repo.install(targetScope, {
        kind: SkillSourceKind.SkillMd,
        bytes: skillMdBytes,
      });
      await expect(
        repo.branch({ scope, toVersion: '2.0.0' }),
      ).rejects.toBeInstanceOf(SkillValidationError);
    });
  });
}
