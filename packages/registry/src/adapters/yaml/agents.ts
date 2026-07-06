import type {
  AgentDefinition,
  AgentIdentity,
} from '../../domain/index.js';
import { isMap, isSeq, parseDocument, YAMLMap, YAMLSeq } from 'yaml';

import { AgentNotFoundError, BranchError, RegistryValidationError } from '../../errors.js';
import type { AgentRepository } from '../../interface.js';
import {
  UpdateAgentFieldsInputSchema,
  type BranchInput,
  type BranchResult,
  type UpdateAgentFieldsInput,
  type UpdateAgentFieldsResult,
} from '../../types.js';

import {
  idKey,
  slugKey,
  toIdentity,
  type RegistryIndexes,
  type ValidateResult,
} from './parse.js';

export interface S3YamlAgentRepoDeps {
  getIndex: () => RegistryIndexes;
  readRaw: () => Promise<{ text: string; etag: string | undefined }>;
  writeRaw: (text: string) => Promise<{ etag: string | undefined }>;
  validate: (text: string) => ValidateResult;
}

export class S3YamlAgentRepo implements AgentRepository {
  constructor(private readonly deps: S3YamlAgentRepoDeps) {}

  async listByTenantId(tenantId: string): Promise<AgentDefinition[]> {
    return this.deps.getIndex().byTenantId.get(tenantId) ?? [];
  }
  async listByTenantSlug(tenantSlug: string): Promise<AgentDefinition[]> {
    return this.deps.getIndex().byTenantSlug.get(tenantSlug) ?? [];
  }
  async getByIds(tenantId: string, agentId: string, version: string): Promise<AgentDefinition | null> {
    return this.deps.getIndex().byIds.get(idKey(tenantId, agentId, version)) ?? null;
  }
  async getBySlugs(tenantSlug: string, agentSlug: string, version: string): Promise<AgentDefinition | null> {
    return this.deps.getIndex().bySlugs.get(slugKey(tenantSlug, agentSlug, version)) ?? null;
  }
  async resolveEnabledByIds(tenantId: string, agentId: string): Promise<AgentDefinition> {
    const all = (this.deps.getIndex().byTenantId.get(tenantId) ?? [])
      .filter((a) => a.agentId === agentId && a.enabled);
    if (all.length === 0) {
      throw new Error(`no enabled version for agent ${agentId} in tenant ${tenantId}`);
    }
    if (all.length > 1) {
      throw new Error(
        `multiple enabled versions for agent ${agentId} in tenant ${tenantId} — index build should have caught this`,
      );
    }
    return all[0]!;
  }
  async identities(tenantId: string): Promise<AgentIdentity[]> {
    return (this.deps.getIndex().byTenantId.get(tenantId) ?? []).map(toIdentity);
  }

  async branch(input: BranchInput): Promise<BranchResult> {
    const { text } = await this.deps.readRaw();
    const doc = parseDocument(text);

    const tenants = doc.get('tenants') as YAMLSeq | undefined;
    if (!isSeq(tenants)) {
      throw new Error('registry malformed: `tenants` is not a sequence');
    }

    let tenantNode: unknown = null;
    for (const node of tenants.items) {
      if (isMap(node) && node.get('id') === input.tenantId) {
        tenantNode = node;
        break;
      }
    }
    if (!isMap(tenantNode)) {
      throw new BranchError(`tenant ${input.tenantId} not found`, 404);
    }

    const agents = tenantNode.get('agents') as YAMLSeq | undefined;
    if (!isSeq(agents)) {
      throw new Error(`registry malformed: tenant ${input.tenantId}.agents is not a sequence`);
    }

    let sourceNode: unknown = null;
    const currentlyEnabledIndexes: number[] = [];
    let idx = 0;
    for (const node of agents.items) {
      if (!isMap(node)) {
        idx += 1; continue;
      }
      if (node.get('id') === input.agentId) {
        if (node.get('version') === input.fromVersion) {
          sourceNode = node;
        }
        if (node.get('version') === input.toVersion) {
          throw new BranchError(
            `target version already exists: ${input.tenantId}/${input.agentId}/${input.toVersion}`,
            409,
          );
        }
        if (node.get('enabled') === true) {
          currentlyEnabledIndexes.push(idx);
        }
      }
      idx += 1;
    }
    if (!isMap(sourceNode)) {
      throw new BranchError(
        `source version not found: ${input.tenantId}/${input.agentId}/${input.fromVersion}`,
        404,
      );
    }

    const cloned = sourceNode.clone() as ReturnType<typeof sourceNode.clone>;
    if (!isMap(cloned)) throw new Error('unexpected clone shape');
    cloned.set('version', input.toVersion);
    cloned.set('enabled', input.enabled);

    if (input.enabled) {
      for (const i of currentlyEnabledIndexes) {
        const existing = agents.items[i];
        if (isMap(existing)) {
          existing.set('enabled', false);
        }
      }
    }

    agents.items.push(cloned);

    const nextText = doc.toString();
    const write = await this.deps.writeRaw(nextText);
    const target = await this.getByIds(input.tenantId, input.agentId, input.toVersion);
    if (!target) {
      throw new Error(
        `branch wrote successfully but re-read did not find (${input.tenantId}, ${input.agentId}, ${input.toVersion})`,
      );
    }
    return {
      target,
      etag: write.etag,
    };
  }

  async updateFields(input: UpdateAgentFieldsInput): Promise<UpdateAgentFieldsResult> {
    const parsedResult = UpdateAgentFieldsInputSchema.safeParse(input);
    if (!parsedResult.success) {
      throw new RegistryValidationError(
        `invalid updateFields input: ${parsedResult.error.issues.map((i) => i.message).join('; ')}`,
      );
    }
    const parsed = parsedResult.data;

    const { text } = await this.deps.readRaw();

    const preflight = this.deps.validate(text);
    if (!preflight.ok) {
      throw new RegistryValidationError(
        `registry corrupted before edit: ${preflight.error.message}`,
      );
    }

    const doc = parseDocument(text);
    const tenants = doc.get('tenants') as YAMLSeq;
    const tenantNode = findMapItem(tenants, (n) => n.get('id') === parsed.tenantId);
    if (!tenantNode) {
      throw new AgentNotFoundError(`tenant ${parsed.tenantId} not found`);
    }

    const agents = tenantNode.get('agents') as YAMLSeq;
    const targetNode = findMapItem(
      agents,
      (n) => n.get('id') === parsed.agentId && n.get('version') === parsed.version,
    );
    if (!targetNode) {
      throw new AgentNotFoundError(
        `agent not found: ${parsed.tenantId}/${parsed.agentId}/${parsed.version}`,
      );
    }

    for (const key of ['description', 'systemPrompt', 'model', 'tools'] as const) {
      const value = parsed.patch[key];
      if (value !== undefined) {
        targetNode.set(key, value);
      }
    }

    const nextText = doc.toString();
    const write = await this.deps.writeRaw(nextText);
    const target = await this.getByIds(parsed.tenantId, parsed.agentId, parsed.version);
    if (!target) {
      throw new Error(
        `updateFields wrote successfully but re-read did not find (${parsed.tenantId}, ${parsed.agentId}, ${parsed.version})`,
      );
    }
    return {
      target,
      etag: write.etag,
    };
  }
}

function findMapItem(seq: YAMLSeq, predicate: (n: YAMLMap) => boolean): YAMLMap | null {
  for (const node of seq.items) {
    if (isMap(node) && predicate(node)) {
      return node;
    }
  }
  return null;
}
