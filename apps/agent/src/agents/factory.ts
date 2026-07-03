import { Agent, type Tool, type ToolList } from '@strands-agents/sdk';
import type { AgentSkills } from '@strands-agents/sdk/vended-plugins/skills';

import type { AgentDefinition, RegistryRepository } from '@repo/registry';
import { TenantVars } from '@repo/registry';

import type { Scope } from '@repo/kit/identity';

import { KB_ID, KB_WEB_DATA_SOURCE_ID, UPLOADS_BUCKET } from '../config.js';
import { resolveModel } from '../models/index.js';
import { wireSkills } from '../skills/wire.js';
import { createSearchDocumentsTool } from '../tools/search_documents/index.js';
import { createSearchWebTool } from '../tools/search_web/index.js';
import { resolveTool } from '../tools/_lib/resolver.js';

export type BuildAgentInput = {
  def: AgentDefinition;
  registry: RegistryRepository;
};

export type BuiltAgent = {
  agent: Agent;
  skillsPlugin: AgentSkills | undefined;
  refreshSkillsIfStale: () => Promise<void>;
};

export async function buildAgent({ def, registry }: BuildAgentInput): Promise<BuiltAgent> {
  const scope: Scope = {
    tenantId: def.tenantId,
    agentId: def.agentId,
    version: def.version,
  };

  const vars = new TenantVars(await registry.vars.listByTenantId(def.tenantId));
  const mcpServers = await registry.mcpServers.listByTenantId(def.tenantId);

  const model = resolveModel(def.model, vars);

  const registryTools: ToolList = [];
  for (const ref of def.tools) {
    registryTools.push(...resolveTool(ref, mcpServers, vars));
  }

  const kbTools = buildKbTools(scope);

  const skillsWiring = await wireSkills({ scope, uploadsBucket: UPLOADS_BUCKET ?? null });

  const agent = new Agent({
    model,
    systemPrompt: def.systemPrompt,
    tools: [...registryTools, ...kbTools, ...skillsWiring.tools],
  });

  return {
    agent,
    skillsPlugin: skillsWiring.plugin,
    refreshSkillsIfStale: skillsWiring.refreshSkillsIfStale,
  };
}

function buildKbTools(scope: Scope): Tool[] {
  if (!KB_ID) return [];
  const tools: Tool[] = [
    createSearchDocumentsTool({
      kbId: KB_ID,
      tenantId: scope.tenantId,
      agentIds: [scope.agentId],
      version: scope.version,
    }),
  ];
  if (KB_WEB_DATA_SOURCE_ID) {
    tools.push(createSearchWebTool({
      kbId: KB_ID,
      tenantId: scope.tenantId,
      agentIds: [scope.agentId],
      version: scope.version,
    }));
  }
  return tools;
}
