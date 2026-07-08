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
  McpAuthKind,
  ModelProvider,
  VarKind,
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
  LIVE_VERSION_ALIAS,
  isLiveAlias,
  resolveAgentWithLive,
} from './live.js';

export {
  AnthropicModels,
  BedrockModels,
  MODELS_BY_PROVIDER,
  OpenAIModels,
  type AnthropicModelId,
  type BedrockModelId,
  type OpenAIModelId,
} from './domain/index.js';

export {
  type AgentRepository,
  type BuiltinToolRepository,
  type McpServerRepository,
  type RawTextEditable,
  type RegistryRepository,
  type TenantRepository,
  type VarRepository,
} from './interface.js';

export type {
  BranchInput,
  BranchResult,
  SetEnabledInput,
  SetEnabledResult,
  UpdateAgentFieldsInput,
  UpdateAgentFieldsResult,
} from './types.js';

export { UpdateAgentFieldsInputSchema } from './types.js';

export {
  AgentNotFoundError,
  BranchError,
  RegistryValidationError,
} from './errors.js';

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
  YamlRegistryRepository,
  type YamlRegistryRepositoryOptions,
} from './adapters/yaml/registry.js';
export {
  type YamlSource,
  type YamlSourceReadResult,
} from './adapters/yaml/source.js';
export {
  S3YamlRegistryRepository,
  S3YamlSource,
  type S3YamlRegistryRepositoryOptions,
  type S3YamlSourceOptions,
} from './adapters/yaml/s3.js';
// LocalYamlRegistryRepository lives under @repo/registry/local-yaml so the barrel
// stays browser-safe (LocalYamlSource pulls in node:fs/promises).
export {
  PostgresRegistryRepository,
  type PostgresRegistryRepositoryOptions,
} from './adapters/database/postgres.js';
