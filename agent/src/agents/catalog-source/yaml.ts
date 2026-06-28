import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

import { BUILTIN_TOOLS } from '../../tools/registry.js';
import type {
  AgentCatalog,
  AgentDefinition,
  McpServerConfig,
  ToolRef,
  Var,
  VarTemplated,
} from '../catalog.js';
import { assertVarRefSyntax, extractVarRefs } from '../vars.js';

const TOOL_REF_REGEX = /^(?:builtin__[a-z0-9_]+|mcp__[a-z0-9_-]+)$/;

const VarTemplatedSchema = z.string().min(1);

const McpAuthSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('bearer'), token: VarTemplatedSchema }),
  z.object({
    kind: z.literal('header'),
    name: z.string().min(1),
    value: VarTemplatedSchema,
  }),
]);

const McpServerSchema = z.object({
  url: z.string().url(),
  auth: McpAuthSchema.optional(),
});

const ToolRefSchema = z.string().regex(
  TOOL_REF_REGEX,
  'tool ref must match builtin__<name> or mcp__<server>',
);

const VarSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('plain'), value: z.string() }),
  z.object({
    type: z.literal('secretmanager'),
    secretId: z.string().min(1),
    region: z.string().min(1).optional(),
    jsonField: z.string().min(1).optional(),
  }),
]);

const BedrockCredentialsSchema = z.object({
  accessKeyId: VarTemplatedSchema,
  secretAccessKey: VarTemplatedSchema,
  sessionToken: VarTemplatedSchema.optional(),
});

const BedrockModelSchema = z.object({
  id: z.string().min(1),
  region: z.string().min(1).optional(),
  credentials: BedrockCredentialsSchema.optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

const OpenAIModelSchema = z.object({
  id: z.string().min(1),
  apiKey: VarTemplatedSchema,
  baseUrl: z.string().url().optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

const AnthropicModelSchema = z.object({
  id: z.string().min(1),
  apiKey: VarTemplatedSchema,
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

const ModelSchema = z.discriminatedUnion('provider', [
  z.object({ provider: z.literal('bedrock'),   bedrock:   BedrockModelSchema }),
  z.object({ provider: z.literal('openai'),    openai:    OpenAIModelSchema }),
  z.object({ provider: z.literal('anthropic'), anthropic: AnthropicModelSchema }),
]);

const AgentSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  systemPrompt: z.string().min(1),
  model: ModelSchema,
  tools: z.array(ToolRefSchema),
});

const TenantSchema = z.object({
  id: z.string().min(1),
  // YAML `vars:` / `mcpServers:` with no children parse as null.
  vars: z
    .record(z.string(), VarSchema)
    .nullish()
    .transform(v => v ?? {}),
  mcpServers: z
    .record(z.string(), McpServerSchema)
    .nullish()
    .transform(v => v ?? {}),
  agents: z.array(AgentSchema).min(1),
});

const CatalogFileSchema = z.object({
  tenants: z.array(TenantSchema).min(1),
});

type CatalogFile = z.infer<typeof CatalogFileSchema>;

export class YamlAgentCatalog implements AgentCatalog {
  private readonly path: string;
  private byKey = new Map<string, AgentDefinition>();
  private byTenant = new Map<string, AgentDefinition[]>();
  private mcpByTenant = new Map<string, Record<string, McpServerConfig>>();
  private varsByTenant = new Map<string, Record<string, Var>>();

  constructor(path: string) {
    this.path = path;
  }

  async load(): Promise<void> {
    const raw = await readFile(this.path, 'utf8');
    const parsed = parseYaml(raw) as unknown;
    const file: CatalogFile = CatalogFileSchema.parse(parsed);

    for (const tenant of file.tenants) {
      this.mcpByTenant.set(tenant.id, tenant.mcpServers);
      this.varsByTenant.set(tenant.id, tenant.vars);

      this.assertMcpVarRefsResolvable(tenant.id, tenant.mcpServers, tenant.vars);

      const list: AgentDefinition[] = [];
      for (const agent of tenant.agents) {
        const agentKey = `${tenant.id}/${agent.id}`;
        for (const ref of agent.tools) {
          this.assertToolRefResolvable(ref, agentKey, tenant.mcpServers);
        }
        this.assertModelVarRefsResolvable(agent.model, agentKey, tenant.vars);
        const def: AgentDefinition = {
          tenantId: tenant.id,
          id: agent.id,
          description: agent.description,
          systemPrompt: agent.systemPrompt,
          model: agent.model,
          tools: agent.tools,
        };
        this.byKey.set(agentKey, def);
        list.push(def);
      }
      this.byTenant.set(tenant.id, list);
    }
  }

  private assertToolRefResolvable(
    ref: ToolRef,
    agentKey: string,
    tenantMcp: Record<string, McpServerConfig>,
  ): void {
    if (ref.startsWith('builtin__')) {
      const name = ref.slice('builtin__'.length);
      if (!(name in BUILTIN_TOOLS)) {
        throw new Error(`agent ${agentKey} references unknown builtin tool: ${name}`);
      }
      return;
    }
    if (ref.startsWith('mcp__')) {
      const server = ref.slice('mcp__'.length);
      if (server.includes('__')) {
        throw new Error(
          `agent ${agentKey}: mcp tool ref "${ref}" uses the granular `
          + `"mcp__<server>__<tool>" form which Strands TS doesn't support. `
          + `Use "mcp__${server.slice(0, server.indexOf('__'))}" instead.`,
        );
      }
      if (!(server in tenantMcp)) {
        throw new Error(
          `agent ${agentKey} references unknown mcp server: ${server} `
          + `(not declared under tenant.mcpServers)`,
        );
      }
      return;
    }
    throw new Error(`agent ${agentKey}: unrecognised tool ref shape: ${ref}`);
  }

  private assertModelVarRefsResolvable(
    model: AgentDefinition['model'],
    agentKey: string,
    tenantVars: Record<string, Var>,
  ): void {
    const check = (value: VarTemplated | undefined, field: string): void => {
      if (value === undefined) return;
      assertTemplateResolvable(value, tenantVars, `agent ${agentKey}: model.${field}`);
    };
    switch (model.provider) {
      case 'bedrock': {
        const c = model.bedrock.credentials;
        if (c) {
          check(c.accessKeyId,    'bedrock.credentials.accessKeyId');
          check(c.secretAccessKey, 'bedrock.credentials.secretAccessKey');
          check(c.sessionToken,    'bedrock.credentials.sessionToken');
        }
        return;
      }
      case 'openai':
        check(model.openai.apiKey, 'openai.apiKey');
        return;
      case 'anthropic':
        check(model.anthropic.apiKey, 'anthropic.apiKey');
        return;
    }
  }

  private assertMcpVarRefsResolvable(
    tenantId: string,
    mcpServers: Record<string, McpServerConfig>,
    tenantVars: Record<string, Var>,
  ): void {
    for (const [serverName, server] of Object.entries(mcpServers)) {
      if (!server.auth) continue;
      const loc = `tenant ${tenantId}: mcpServers.${serverName}.auth`;
      if (server.auth.kind === 'bearer') {
        assertTemplateResolvable(server.auth.token, tenantVars, `${loc}.token`);
      } else {
        assertTemplateResolvable(server.auth.value, tenantVars, `${loc}.value`);
      }
    }
  }

  async list(tenantId: string): Promise<AgentDefinition[]> {
    return this.byTenant.get(tenantId) ?? [];
  }

  async get(tenantId: string, agentId: string): Promise<AgentDefinition | null> {
    return this.byKey.get(`${tenantId}/${agentId}`) ?? null;
  }

  async mcpServers(tenantId: string): Promise<Record<string, McpServerConfig>> {
    return this.mcpByTenant.get(tenantId) ?? {};
  }

  async vars(tenantId: string): Promise<Record<string, Var>> {
    return this.varsByTenant.get(tenantId) ?? {};
  }
}

function assertTemplateResolvable(
  value: VarTemplated,
  tenantVars: Record<string, Var>,
  location: string,
): void {
  assertVarRefSyntax(value, location);
  for (const name of extractVarRefs(value)) {
    if (!(name in tenantVars)) {
      throw new Error(
        `${location} references unknown var "${name}" via `
        + `"{{ vars.${name} }}" (not declared under tenant.vars). `
        + `Available: ${Object.keys(tenantVars).join(', ') || '(none)'}`,
      );
    }
  }
}
