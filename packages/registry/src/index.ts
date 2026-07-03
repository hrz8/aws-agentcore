export type {
  AgentDefinition,
  AgentIdentity,
  AnthropicModelDef,
  BedrockCredentials,
  BedrockModelDef,
  McpAuth,
  McpServerConfig,
  ModelDef,
  OpenAIModelDef,
  TenantIdentity,
  ToolRef,
  Var,
  VarTemplated,
} from './domain/index.js';

export {
  AgentRowSchema,
  AnthropicModelSchema,
  BedrockCredentialsSchema,
  BedrockModelSchema,
  McpAuthSchema,
  McpServerSchema,
  ModelSchema,
  OpenAIModelSchema,
  SLUG_REGEX,
  SlugSchema,
  TOOL_REF_REGEX,
  ToolRefSchema,
  UUID_REGEX,
  UuidSchema,
  VERSION_REGEX,
  VarSchema,
  VarTemplatedSchema,
  VersionSchema,
  type AgentRow,
} from './domain/index.js';

export {
  TenantVars,
  assertVarRefSyntax,
  extractVarRefs,
} from './domain/index.js';

export {
  type AgentRepository,
  type McpServerRepository,
  type RawTextEditable,
  type RegistryRepository,
  type TenantRepository,
  type VarRepository,
} from './interface.js';

export type { BranchInput, BranchResult } from './types.js';

export { BranchError, RegistryValidationError } from './errors.js';

export {
  parseRegistryYaml,
  validateRegistryText,
  idKey,
  slugKey,
  toIdentity,
  RegistryFileSchema,
  TenantSchema,
  type RegistryFile,
  type RegistryIndexes,
  type ParseOptions,
  type TenantRow,
  type ValidateResult,
  type ValidationError,
} from './adapters/yaml/parse.js';

export {
  S3YamlRegistryRepository,
  type S3YamlRegistryRepositoryOptions,
} from './adapters/yaml/s3.js';
export {
  PostgresRegistryRepository,
  type PostgresRegistryRepositoryOptions,
} from './adapters/database/postgres.js';
