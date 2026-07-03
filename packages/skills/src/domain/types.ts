export type SkillSummary = {
  name: string;
  description: string;
};

export type SkillDetail = {
  name: string;
  description: string;
  allowedTools: string[];
  license: string | null;
  compatibility: string | null;
  instructions: string;
  resources: string[];
};

export type SkillContent = {
  skillMd: string;
  resources: string[];
};

export const SkillSourceKind = {
  Zip: 'zip',
  SkillMd: 'skill-md',
} as const;
export type SkillSourceKind =
  typeof SkillSourceKind[keyof typeof SkillSourceKind];

export type SkillSource =
  | { kind: typeof SkillSourceKind.Zip; bytes: Uint8Array }
  | { kind: typeof SkillSourceKind.SkillMd; bytes: Uint8Array };

export type SkillBranchOutcome = {
  sourceVersion: string;
  targetVersion: string;
  filesCopied: number;
  sidecarsRewritten: number;
  sourcePrefix: string;
  targetPrefix: string;
};

export type SignedResourceUrl = {
  url: string;
  expiresIn: number;
};
