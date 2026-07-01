import AdmZip from 'adm-zip';

import { parseSkillMd, type SkillFrontmatter, SkillValidationError } from './skill-md.js';

const MAX_ENTRIES = 200;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 32 * 1024 * 1024;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_RESOURCE_FILES = 64;

const ALLOWED_TOP_DIRS = new Set(['references', 'scripts', 'assets']);

export type ExtractedSkill = {
  frontmatter: SkillFrontmatter;
  skillMd: string;
  resources: Map<string, Buffer>;
};

export function extractSkillZip(zipBuf: Buffer): ExtractedSkill {
  let zip: AdmZip;
  try {
    zip = new AdmZip(zipBuf);
  } catch (err) {
    throw new SkillValidationError(
      `zip parse failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const entries = zip.getEntries();
  if (entries.length > MAX_ENTRIES) {
    throw new SkillValidationError(`zip has ${entries.length} entries, max is ${MAX_ENTRIES}`);
  }

  const fileEntries = entries.filter(e => !e.isDirectory);
  if (fileEntries.length === 0) {
    throw new SkillValidationError('zip contains no files');
  }

  const topSegments = new Set<string>();
  for (const e of fileEntries) {
    const seg = topSegmentOf(e.entryName);
    if (seg) topSegments.add(seg);
  }
  let rootPrefix = '';
  if (topSegments.size === 1) {
    const [only] = [...topSegments];
    if (only && !ALLOWED_TOP_DIRS.has(only) && only !== 'SKILL.md') {
      rootPrefix = `${only}/`;
    }
  }

  let skillMdBuf: Buffer | null = null;
  const resources = new Map<string, Buffer>();
  let totalBytes = 0;

  for (const e of entries) {
    if (e.isDirectory) continue;

    // Reject symlinks — otherwise a `..`-targeted symlink would bypass the
    // path traversal check below at unzip time. High 16 bits of `attr` are
    // the unix mode; 0o120000 = symlink.
    const unixMode = (e.attr ?? 0) >>> 16;
    if ((unixMode & 0o170000) === 0o120000) {
      throw new SkillValidationError(`zip contains symlink: ${e.entryName}`);
    }

    let rel = e.entryName;
    if (rootPrefix && rel.startsWith(rootPrefix)) {
      rel = rel.slice(rootPrefix.length);
    }
    if (!rel) continue;

    if (rel.includes('..') || rel.startsWith('/')) {
      throw new SkillValidationError(`zip path traversal rejected: ${e.entryName}`);
    }
    if (rel.startsWith('__MACOSX/') || rel.endsWith('/.DS_Store') || rel === '.DS_Store') {
      continue;
    }

    const data = e.getData();
    if (data.length > MAX_FILE_BYTES) {
      throw new SkillValidationError(
        `file ${rel} is ${data.length} bytes, max per-file is ${MAX_FILE_BYTES}`,
      );
    }
    totalBytes += data.length;
    if (totalBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
      throw new SkillValidationError(
        `zip uncompressed total exceeds ${MAX_TOTAL_UNCOMPRESSED_BYTES} bytes`,
      );
    }

    if (rel === 'SKILL.md') {
      if (skillMdBuf) {
        throw new SkillValidationError('zip contains multiple SKILL.md files');
      }
      skillMdBuf = data;
      continue;
    }

    const segs = rel.split('/');
    const top = segs[0];
    if (!top || !ALLOWED_TOP_DIRS.has(top)) {
      throw new SkillValidationError(
        `zip contains disallowed path: ${rel}. Only SKILL.md, references/, scripts/, assets/ are allowed.`,
      );
    }
    if (resources.size >= MAX_RESOURCE_FILES) {
      throw new SkillValidationError(`too many resource files (max ${MAX_RESOURCE_FILES})`);
    }
    resources.set(rel, data);
  }

  if (!skillMdBuf) {
    throw new SkillValidationError('zip missing SKILL.md');
  }

  const skillMd = skillMdBuf.toString('utf-8');
  const { frontmatter } = parseSkillMd(skillMd);

  return { frontmatter, skillMd, resources };
}

function topSegmentOf(p: string): string | null {
  const i = p.indexOf('/');
  if (i < 0) return null;
  return p.slice(0, i);
}
