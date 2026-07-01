import { getJson, postJson, HttpError } from './http';

const MIDDLEWARE_URL =
  import.meta.env.VITE_MIDDLEWARE_URL ?? 'http://localhost:7890';

export type SkillSummary = {
  name: string;
  description: string;
};

export type UploadResponse = {
  name: string;
  resourceCount: number;
};

export function listSkills(): Promise<{ skills: SkillSummary[] }> {
  return getJson(`${MIDDLEWARE_URL}/skills`);
}

export async function uploadSkill(file: File): Promise<UploadResponse> {
  const kind = pickKind(file);
  const contentBase64 = await fileToBase64(file);
  return postJson(`${MIDDLEWARE_URL}/skills/upload`, {
    kind,
    filename: file.name,
    contentBase64,
  });
}

export async function deleteSkill(name: string): Promise<{ deleted: number }> {
  const res = await fetch(`${MIDDLEWARE_URL}/skills/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new HttpError(res.status, res.url, await res.text().catch(() => ''));
  }
  return res.json();
}

function pickKind(file: File): 'zip' | 'skill-md' {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.zip')) return 'zip';
  if (lower === 'skill.md' || lower.endsWith('.md')) return 'skill-md';
  // Fallback based on MIME (some browsers set application/zip)
  if (file.type === 'application/zip' || file.type === 'application/x-zip-compressed') return 'zip';
  return 'skill-md';
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('unexpected FileReader result'));
        return;
      }
      // Strip the "data:*;base64," prefix
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('file read failed'));
    reader.readAsDataURL(file);
  });
}
