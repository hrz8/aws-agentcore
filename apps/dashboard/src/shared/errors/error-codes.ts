export const ErrorCode = {
  BadRequest: 'BAD_REQUEST',
  Unauthorized: 'UNAUTHORIZED',
  Forbidden: 'FORBIDDEN',
  NotFound: 'NOT_FOUND',
  Conflict: 'CONFLICT',
  ValidationFailed: 'VALIDATION_FAILED',

  InternalError: 'INTERNAL_ERROR',
  UpstreamError: 'UPSTREAM_ERROR',
  UpstreamTimeout: 'UPSTREAM_TIMEOUT',

  NoTenantSelected: 'NO_TENANT_SELECTED',
  TenantNotFound: 'TENANT_NOT_FOUND',
  TenantAccessDenied: 'TENANT_ACCESS_DENIED',

  RegistryValidationFailed: 'REGISTRY_VALIDATION_FAILED',
  RegistryBranchConflict: 'REGISTRY_BRANCH_CONFLICT',
  RegistryBranchSameVersion: 'REGISTRY_BRANCH_SAME_VERSION',
  RegistryNotEditable: 'REGISTRY_NOT_EDITABLE',
  AgentNotFound: 'AGENT_NOT_FOUND',

  KbIngestFailed: 'KB_INGEST_FAILED',
  KbIngestTimeout: 'KB_INGEST_TIMEOUT',
  KbIngestForbidden: 'KB_INGEST_FORBIDDEN',
  KbEmptyContent: 'KB_EMPTY_CONTENT',
  KbUnsupportedUri: 'KB_UNSUPPORTED_URI',

  SkillValidationFailed: 'SKILL_VALIDATION_FAILED',
  SkillNameInvalid: 'SKILL_NAME_INVALID',
  SkillUploadFailed: 'SKILL_UPLOAD_FAILED',
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

export const ERROR_CODE_STATUS: Record<ErrorCode, number> = {
  [ErrorCode.BadRequest]: 400,
  [ErrorCode.Unauthorized]: 401,
  [ErrorCode.Forbidden]: 403,
  [ErrorCode.NotFound]: 404,
  [ErrorCode.Conflict]: 409,
  [ErrorCode.ValidationFailed]: 422,

  [ErrorCode.InternalError]: 500,
  [ErrorCode.UpstreamError]: 502,
  [ErrorCode.UpstreamTimeout]: 504,

  [ErrorCode.NoTenantSelected]: 400,
  [ErrorCode.TenantNotFound]: 404,
  [ErrorCode.TenantAccessDenied]: 403,

  [ErrorCode.RegistryValidationFailed]: 422,
  [ErrorCode.RegistryBranchConflict]: 409,
  [ErrorCode.RegistryBranchSameVersion]: 400,
  [ErrorCode.RegistryNotEditable]: 409,
  [ErrorCode.AgentNotFound]: 404,

  [ErrorCode.KbIngestFailed]: 502,
  [ErrorCode.KbIngestTimeout]: 504,
  [ErrorCode.KbIngestForbidden]: 403,
  [ErrorCode.KbEmptyContent]: 422,
  [ErrorCode.KbUnsupportedUri]: 400,

  [ErrorCode.SkillValidationFailed]: 422,
  [ErrorCode.SkillNameInvalid]: 400,
  [ErrorCode.SkillUploadFailed]: 502,
};
