import AdmZip from 'adm-zip';

import type { SkillFrontmatter } from '../domain/schema.js';
import { SkillValidationError } from '../errors.js';

import { parseSkillMd } from './skill-md.js';

const MAX_ENTRIES = 200;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 32 * 1024 * 1024;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_RESOURCE_FILES = 64;
// >100× compression is essentially always a zip bomb.
const MAX_COMPRESSION_RATIO = 100;

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

  const fileEntries = entries.filter((e) => !e.isDirectory);
  if (fileEntries.length === 0) {
    throw new SkillValidationError('zip contains no files');
  }

  const topSegments = new Set<string>();
  for (const e of fileEntries) {
    const seg = topSegmentOf(e.entryName);
    if (seg) {
      topSegments.add(seg);
    }
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
  // Case-insensitive filesystems (macOS/Windows) would collapse case-only dupes.
  const seenLowercase = new Set<string>();

  for (const e of entries) {
    if (e.isDirectory) {
      continue;
    }
    const unixMode = (e.attr ?? 0) >>> 16;
    if ((unixMode & 0o170000) === 0o120000) {
      throw new SkillValidationError(`zip contains symlink: ${e.entryName}`);
    }

    let rel = e.entryName;
    if (rootPrefix && rel.startsWith(rootPrefix)) {
      rel = rel.slice(rootPrefix.length);
    }
    if (!rel) {
      continue;
    }

    if (
      rel.split('/').some((seg) => seg === '..')
      || rel.startsWith('/')
      || rel.match(/^[a-zA-Z]:\\/) // absolute Windows path
    ) {
      throw new SkillValidationError(`zip path traversal rejected: ${e.entryName}`);
    }
    if (rel.startsWith('__MACOSX/') || rel.endsWith('/.DS_Store') || rel === '.DS_Store') {
      continue;
    }

    // Read declared size from the central directory before getData() would
    // materialise the full uncompressed stream — reject bombs cheaply.
    const declaredSize = e.header.size;
    const compressedSize = e.header.compressedSize;
    if (declaredSize > MAX_FILE_BYTES) {
      throw new SkillValidationError(
        `file ${rel} declared ${declaredSize} bytes, max per-file is ${MAX_FILE_BYTES}`,
      );
    }
    if (totalBytes + declaredSize > MAX_TOTAL_UNCOMPRESSED_BYTES) {
      throw new SkillValidationError(
        `zip uncompressed total exceeds ${MAX_TOTAL_UNCOMPRESSED_BYTES} bytes`,
      );
    }
    if (
      compressedSize > 0
      && declaredSize / compressedSize > MAX_COMPRESSION_RATIO
    ) {
      throw new SkillValidationError(
        `file ${rel} has compression ratio ${(declaredSize / compressedSize).toFixed(0)}× (max ${MAX_COMPRESSION_RATIO}×) — possible zip bomb`,
      );
    }

    const lowered = rel.toLowerCase();
    if (seenLowercase.has(lowered)) {
      throw new SkillValidationError(
        `zip contains case-only duplicate: ${rel}`,
      );
    }
    seenLowercase.add(lowered);

    const data = e.getData();
    if (data.length > MAX_FILE_BYTES) {
      throw new SkillValidationError(
        `file ${rel} decompressed to ${data.length} bytes, max is ${MAX_FILE_BYTES}`,
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
  if (i < 0) {
    return null;
  }
  return p.slice(0, i);
}
