import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useCurrentScope } from '#/features/agents';
import { callServerFn } from '#/shared/server-fn/envelope';
import {
  requireScope,
  toWireScope,
  type ResolvedScope,
} from '#/shared/scope';

import { skillsQueries } from './queries';
import {
  deleteSkillServerFn,
  updateSkillMdServerFn,
  uploadSkillServerFn,
} from './server-fns';

const EMPTY_SCOPE: ResolvedScope = {
  tenantId: '',
  tenantSlug: '',
  agentId: '',
  agentVersion: '',
};

export function useSkills() {
  const scope = useCurrentScope();
  return useQuery({
    ...skillsQueries.list(scope ?? EMPTY_SCOPE),
    enabled: !!scope,
  });
}

export function useUploadSkill() {
  const scope = useCurrentScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const s = requireScope(scope);
      const kind = pickKind(file);
      const contentBase64 = await fileToBase64(file);
      return callServerFn(uploadSkillServerFn, {
        scope: toWireScope(s),
        kind,
        filename: file.name,
        contentBase64,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: skillsQueries.all }),
  });
}

export function useSkillContent(name: string | null) {
  const scope = useCurrentScope();
  return useQuery({
    ...skillsQueries.content(scope ?? EMPTY_SCOPE, name ?? ''),
    enabled: !!scope && !!name,
  });
}

export function useUpdateSkillMd() {
  const scope = useCurrentScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, skillMd }: { name: string; skillMd: string }) =>
      callServerFn(updateSkillMdServerFn, {
        scope: toWireScope(requireScope(scope)),
        name,
        skillMd,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: skillsQueries.all }),
  });
}

export function useDeleteSkill() {
  const scope = useCurrentScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      callServerFn(deleteSkillServerFn, {
        scope: toWireScope(requireScope(scope)),
        name,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: skillsQueries.all }),
  });
}

function pickKind(file: File): 'zip' | 'skill-md' {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.zip')) {
    return 'zip';
  }
  if (lower === 'skill.md' || lower.endsWith('.md')) {
    return 'skill-md';
  }
  if (file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
    return 'zip';
  }
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
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('file read failed'));
    reader.readAsDataURL(file);
  });
}
