import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { composeAgentScope, SKILLS_CONFIG } from '../config.js';
import {
  deletePrefix,
  getObjectText,
  listCommonPrefixes,
  listObjects,
  putObject,
} from '../utils/aws/s3/objects.js';
import { presignGetObject } from '../utils/aws/s3/presign.js';
import { parseSkillMd, SKILL_NAME_REGEX, SkillValidationError } from '../utils/skills/skill-md.js';
import { extractSkillZip } from '../utils/skills/zip-extract.js';

const SIGN_URL_TTL_SECONDS = 5 * 60;

const router = Router();

if (!SKILLS_CONFIG) {
  console.warn('[middleware] Skills env not configured; /skills/* routes disabled');
} else {
  const { tenantId, agentId, uploadsBucket } = SKILLS_CONFIG;
  const agentScope = composeAgentScope(tenantId, agentId);
  const skillsPrefix = `skills/${agentScope}/`;
  const skillPrefixFor = (name: string) => `${skillsPrefix}${name}/`;
  const skillMdKeyFor = (name: string) => `${skillPrefixFor(name)}SKILL.md`;
  const skillSidecarKeyFor = (name: string) => `${skillMdKeyFor(name)}.metadata.json`;

  const UploadBodySchema = z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('skill-md'),
      filename: z.string().min(1).max(200).optional(),
      contentBase64: z.string().min(1),
    }),
    z.object({
      kind: z.literal('zip'),
      filename: z.string().min(1).max(200).optional(),
      contentBase64: z.string().min(1),
    }),
  ]);

  router.post('/skills/upload', async (req: Request, res: Response) => {
    const parsed = UploadBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid body', detail: z.treeifyError(parsed.error) });
      return;
    }

    let buf: Buffer;
    try {
      buf = Buffer.from(parsed.data.contentBase64, 'base64');
    } catch {
      res.status(400).json({ error: 'contentBase64 is not valid base64' });
      return;
    }

    try {
      if (parsed.data.kind === 'skill-md') {
        const text = buf.toString('utf-8');
        const { frontmatter } = parseSkillMd(text);
        await writeSkill(frontmatter.name, text, new Map());
        res.json({ name: frontmatter.name, resourceCount: 0 });
        return;
      }

      const extracted = extractSkillZip(buf);
      await writeSkill(extracted.frontmatter.name, extracted.skillMd, extracted.resources);
      res.json({ name: extracted.frontmatter.name, resourceCount: extracted.resources.size });
    } catch (err) {
      if (err instanceof SkillValidationError) {
        res.status(422).json({ error: 'skill validation failed', detail: err.message });
        return;
      }
      res.status(502).json({ error: 'upload failed', detail: errMsg(err) });
    }
  });

  // Delete-then-put so stale resource files from a prior upload don't linger
  // when the new version ships fewer files.
  async function writeSkill(
    name: string,
    skillMd: string,
    resources: Map<string, Buffer>,
  ): Promise<void> {
    await deletePrefix(uploadsBucket, skillPrefixFor(name));

    await Promise.all([
      putObject({
        bucket: uploadsBucket,
        key: skillMdKeyFor(name),
        body: skillMd,
        contentType: 'text/markdown',
      }),
      // Informational only — skills/ is outside Bedrock's inclusionPrefix
      // so KB ingestion never reads this. Kept for admin debuggability.
      putObject({
        bucket: uploadsBucket,
        key: skillSidecarKeyFor(name),
        body: JSON.stringify({
          metadataAttributes: {
            tenant_id: tenantId,
            agent_id: agentId,
            skill_name: name,
          },
        }),
        contentType: 'application/json',
      }),
      ...[...resources.entries()].map(([rel, data]) =>
        putObject({
          bucket: uploadsBucket,
          key: `${skillPrefixFor(name)}${rel}`,
          body: data,
          contentType: guessContentType(rel),
        }),
      ),
    ]);
  }

  router.get('/skills', async (_req, res) => {
    try {
      const prefixes = await listCommonPrefixes(uploadsBucket, skillsPrefix);
      const skills = await Promise.all(
        prefixes.map(async p => {
          const name = p.slice(skillsPrefix.length, -1);
          if (!SKILL_NAME_REGEX.test(name)) return null;
          try {
            const text = await getObjectText(uploadsBucket, skillMdKeyFor(name));
            const { frontmatter } = parseSkillMd(text);
            return { name: frontmatter.name, description: frontmatter.description };
          } catch {
            return { name, description: '(SKILL.md missing or invalid)' };
          }
        }),
      );
      res.json({ skills: skills.filter(s => s !== null) });
    } catch (err) {
      res.status(502).json({ error: 'list failed', detail: errMsg(err) });
    }
  });

  router.get('/skills/:name', async (req, res) => {
    const name = req.params.name;
    if (!name || !SKILL_NAME_REGEX.test(name)) {
      res.status(400).json({ error: 'invalid skill name' });
      return;
    }
    try {
      const [skillMd, files] = await Promise.all([
        getObjectText(uploadsBucket, skillMdKeyFor(name)),
        listObjects(uploadsBucket, skillPrefixFor(name)),
      ]);
      const { frontmatter, body } = parseSkillMd(skillMd);
      const resources = files
        .map(f => f.key.slice(skillPrefixFor(name).length))
        .filter(rel => rel !== 'SKILL.md' && rel !== 'SKILL.md.metadata.json' && rel !== '');
      res.json({
        name: frontmatter.name,
        description: frontmatter.description,
        allowedTools: frontmatter['allowed-tools']?.split(/\s+/).filter(Boolean) ?? [],
        license: frontmatter.license ?? null,
        compatibility: frontmatter.compatibility ?? null,
        instructions: body,
        resources,
      });
    } catch (err) {
      if (err instanceof SkillValidationError) {
        res.status(422).json({ error: 'skill content invalid', detail: err.message });
        return;
      }
      res.status(404).json({ error: 'skill not found', detail: errMsg(err) });
    }
  });

  router.delete('/skills/:name', async (req, res) => {
    const name = req.params.name;
    if (!name || !SKILL_NAME_REGEX.test(name)) {
      res.status(400).json({ error: 'invalid skill name' });
      return;
    }
    try {
      const deleted = await deletePrefix(uploadsBucket, skillPrefixFor(name));
      if (deleted === 0) {
        res.status(404).json({ error: 'skill not found' });
        return;
      }
      res.json({ deleted });
    } catch (err) {
      res.status(502).json({ error: 'delete failed', detail: errMsg(err) });
    }
  });

  // references/ and assets/ only — scripts/ is deliberately not signable.
  const SignQuerySchema = z.object({
    path: z
      .string()
      .min(1)
      .max(512)
      .regex(/^(references|assets)\//, 'only references/ and assets/ are accessible'),
  });

  router.get('/skills/:name/sign', async (req, res) => {
    const name = req.params.name;
    if (!name || !SKILL_NAME_REGEX.test(name)) {
      res.status(400).json({ error: 'invalid skill name' });
      return;
    }
    const parsed = SignQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid query', detail: z.treeifyError(parsed.error) });
      return;
    }
    if (parsed.data.path.includes('..')) {
      res.status(400).json({ error: 'path traversal rejected' });
      return;
    }
    const key = `${skillPrefixFor(name)}${parsed.data.path}`;
    const url = await presignGetObject(uploadsBucket, key, SIGN_URL_TTL_SECONDS, 'inline');
    res.json({ url, expiresIn: SIGN_URL_TTL_SECONDS });
  });
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function guessContentType(rel: string): string {
  const ext = rel.toLowerCase().split('.').pop() ?? '';
  switch (ext) {
    case 'md': return 'text/markdown';
    case 'json': return 'application/json';
    case 'yaml':
    case 'yml': return 'application/yaml';
    case 'txt': return 'text/plain';
    case 'csv': return 'text/csv';
    case 'sh': return 'text/x-shellscript';
    case 'py': return 'text/x-python';
    case 'js': return 'text/javascript';
    case 'ts': return 'text/x-typescript';
    case 'html': return 'text/html';
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'svg': return 'image/svg+xml';
    default: return 'application/octet-stream';
  }
}

export default router;
