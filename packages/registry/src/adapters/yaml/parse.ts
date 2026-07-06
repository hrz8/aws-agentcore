import {
  AgentRowSchema,
  McpAuthKind,
  ModelProvider,
  SlugSchema,
  UuidSchema,
  assertVarRefSyntax,
  extractVarRefs,
  type AgentDefinition,
  type AgentIdentity,
  type AgentRow,
  type BuiltinToolConfig,
  type McpServerConfig,
  type TenantIdentity,
  type Var,
  type VarTemplated,
} from '../../domain/index.js';
import {
  BuiltinToolConfigSchema,
  BuiltinToolNameSchema,
  McpServerSchema,
  VarSchema,
} from '../../domain/index.js';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

export const TenantSchema = z.object({
  id: UuidSchema,
  slug: SlugSchema,
  name: z.string().min(1).max(128).optional(),
  vars: z.record(z.string(), VarSchema).nullish().transform((v) => v ?? {}),
  mcpServers: z.record(z.string(), McpServerSchema).nullish().transform((v) => v ?? {}),
  agents: z.array(AgentRowSchema).min(1),
});
export type TenantRow = z.infer<typeof TenantSchema>;

export const RegistryFileSchema = z.object({
  tools: z.record(BuiltinToolNameSchema, BuiltinToolConfigSchema).nullish().transform((v) => v ?? {}),
  tenants: z.array(TenantSchema).min(1),
});
export type RegistryFile = z.infer<typeof RegistryFileSchema>;

export type RegistryIndexes = {
  byIds: Map<string, AgentDefinition>;
  bySlugs: Map<string, AgentDefinition>;
  byTenantId: Map<string, AgentDefinition[]>;
  byTenantSlug: Map<string, AgentDefinition[]>;
  mcpByTenantId: Map<string, Record<string, McpServerConfig>>;
  varsByTenantId: Map<string, Record<string, Var>>;
  tenantsById: Map<string, TenantIdentity>;
  builtinTools: Record<string, BuiltinToolConfig>;
};

export type ParseOptions = {
  readonly allowedBuiltinTools: ReadonlySet<string> | null;
};

export function parseRegistryYaml(text: string, opts: ParseOptions): RegistryIndexes {
  const raw = parseYaml(text) as unknown;
  const file = RegistryFileSchema.parse(raw);
  return buildIndexes(file, opts);
}

export type ValidationError = {
  kind: 'yaml-parse' | 'schema' | 'semantic';
  message: string;
  detail?: unknown;
};
export type ValidateResult =
  | { ok: true; parsed: RegistryFile }
  | { ok: false; error: ValidationError };

export function validateRegistryText(text: string, opts: ParseOptions): ValidateResult {
  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (err) {
    return {
      ok: false,
      error: { kind: 'yaml-parse', message: err instanceof Error ? err.message : String(err) },
    };
  }
  const zodResult = RegistryFileSchema.safeParse(raw);
  if (!zodResult.success) {
    return {
      ok: false,
      error: { kind: 'schema', message: 'schema validation failed', detail: zodResult.error.issues },
    };
  }
  const parsed = zodResult.data;
  try {
    buildIndexes(parsed, opts);
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: 'semantic',
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
  return {
    ok: true,
    parsed,
  };
}

function buildIndexes(file: RegistryFile, opts: ParseOptions): RegistryIndexes {
  const idx: RegistryIndexes = {
    byIds: new Map(),
    bySlugs: new Map(),
    byTenantId: new Map(),
    byTenantSlug: new Map(),
    mcpByTenantId: new Map(),
    varsByTenantId: new Map(),
    tenantsById: new Map(),
    builtinTools: file.tools,
  };

  const tenantIds = new Set<string>();
  const tenantSlugs = new Set<string>();
  for (const tenant of file.tenants) {
    if (tenantIds.has(tenant.id)) {
      throw new Error(`duplicate tenant id: ${tenant.id}`);
    }
    if (tenantSlugs.has(tenant.slug)) {
      throw new Error(`duplicate tenant slug: ${tenant.slug}`);
    }
    tenantIds.add(tenant.id);
    tenantSlugs.add(tenant.slug);
  }

  for (const tenant of file.tenants) {
    idx.tenantsById.set(tenant.id, {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.name ?? tenant.slug,
    });
    idx.mcpByTenantId.set(tenant.id, tenant.mcpServers);
    idx.varsByTenantId.set(tenant.id, tenant.vars);
    assertMcpVarRefsResolvable(tenant.id, tenant.mcpServers, tenant.vars);

    const agentIdToSlug = new Map<string, string>();
    const slugToAgentId = new Map<string, string>();
    const list: AgentDefinition[] = [];
    const enabledCountByAgentId = new Map<string, number>();
    const versionSeenByAgentId = new Map<string, Set<string>>();

    for (const row of tenant.agents) {
      const agentKey = `${tenant.slug}/${row.slug}`;

      const existingSlug = agentIdToSlug.get(row.id);
      if (existingSlug !== undefined && existingSlug !== row.slug) {
        throw new Error(
          `tenant ${tenant.slug}: agent id ${row.id} maps to two different slugs `
          + `("${existingSlug}" and "${row.slug}") — every version of the same agent must share id+slug`,
        );
      }
      agentIdToSlug.set(row.id, row.slug);

      const existingId = slugToAgentId.get(row.slug);
      if (existingId !== undefined && existingId !== row.id) {
        throw new Error(
          `tenant ${tenant.slug}: agent slug "${row.slug}" maps to two different ids `
          + `(${existingId} and ${row.id})`,
        );
      }
      slugToAgentId.set(row.slug, row.id);

      const seen = versionSeenByAgentId.get(row.id) ?? new Set<string>();
      if (seen.has(row.version)) {
        throw new Error(
          `tenant ${tenant.slug}: duplicate (agent, version): ${agentKey}/${row.version}`,
        );
      }
      seen.add(row.version);
      versionSeenByAgentId.set(row.id, seen);

      for (const ref of row.tools) {
        assertToolRefResolvable(ref, `${agentKey}/${row.version}`, tenant.mcpServers, opts);
      }
      assertModelVarRefsResolvable(row.model, `${agentKey}/${row.version}`, tenant.vars);

      if (row.enabled) {
        enabledCountByAgentId.set(row.id, (enabledCountByAgentId.get(row.id) ?? 0) + 1);
      }

      const def: AgentDefinition = {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        agentId: row.id,
        agentSlug: row.slug,
        version: row.version,
        enabled: row.enabled,
        description: row.description,
        systemPrompt: row.systemPrompt,
        model: row.model,
        tools: row.tools,
      };
      idx.byIds.set(idKey(tenant.id, row.id, row.version), def);
      idx.bySlugs.set(slugKey(tenant.slug, row.slug, row.version), def);
      list.push(def);
    }

    for (const [agentId, count] of enabledCountByAgentId) {
      if (count > 1) {
        const slug = agentIdToSlug.get(agentId) ?? agentId;
        throw new Error(
          `tenant ${tenant.slug}: agent ${slug} (${agentId}) has ${count} enabled versions; exactly 1 required`,
        );
      }
    }
    for (const [agentId, slug] of agentIdToSlug) {
      if (!enabledCountByAgentId.has(agentId)) {
        throw new Error(
          `tenant ${tenant.slug}: agent ${slug} (${agentId}) has no enabled version; exactly 1 required`,
        );
      }
    }

    idx.byTenantId.set(tenant.id, list);
    idx.byTenantSlug.set(tenant.slug, list);
  }

  return idx;
}

function assertToolRefResolvable(
  ref: string,
  agentKey: string,
  tenantMcp: Record<string, McpServerConfig>,
  opts: ParseOptions,
): void {
  if (ref.startsWith('builtin__')) {
    const name = ref.slice('builtin__'.length);
    if (opts.allowedBuiltinTools && !opts.allowedBuiltinTools.has(name)) {
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

function assertModelVarRefsResolvable(
  model: AgentRow['model'],
  agentKey: string,
  tenantVars: Record<string, Var>,
): void {
  const check = (value: VarTemplated | undefined, field: string): void => {
    if (value === undefined) {
      return;
    }
    assertTemplateResolvable(value, tenantVars, `agent ${agentKey}: model.${field}`);
  };
  switch (model.provider) {
    case ModelProvider.Bedrock: {
      const c = model.bedrock.credentials;
      if (c) {
        check(c.accessKeyId, 'bedrock.credentials.accessKeyId');
        check(c.secretAccessKey, 'bedrock.credentials.secretAccessKey');
        check(c.sessionToken, 'bedrock.credentials.sessionToken');
      }
      return;
    }
    case ModelProvider.OpenAI:
      check(model.openai.apiKey, 'openai.apiKey');
      return;
    case ModelProvider.Anthropic:
      check(model.anthropic.apiKey, 'anthropic.apiKey');
      return;
  }
}

function assertMcpVarRefsResolvable(
  tenantId: string,
  mcpServers: Record<string, McpServerConfig>,
  tenantVars: Record<string, Var>,
): void {
  for (const [serverName, server] of Object.entries(mcpServers)) {
    if (!server.auth) {
      continue;
    }
    const loc = `tenant ${tenantId}: mcpServers.${serverName}.auth`;
    if (server.auth.kind === McpAuthKind.Bearer) {
      assertTemplateResolvable(server.auth.token, tenantVars, `${loc}.token`);
    } else {
      assertTemplateResolvable(server.auth.value, tenantVars, `${loc}.value`);
    }
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

export function idKey(tenantId: string, agentId: string, version: string): string {
  return `${tenantId}/${agentId}/${version}`;
}

export function slugKey(tenantSlug: string, agentSlug: string, version: string): string {
  return `${tenantSlug}/${agentSlug}/${version}`;
}

export function toIdentity(def: AgentDefinition): AgentIdentity {
  return {
    tenantId: def.tenantId,
    tenantSlug: def.tenantSlug,
    agentId: def.agentId,
    agentSlug: def.agentSlug,
    version: def.version,
    enabled: def.enabled,
    description: def.description,
  };
}
