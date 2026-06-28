import { Agent, type ToolList } from '@strands-agents/sdk';

import { resolveModel } from '../models/index.js';
import { resolveTool } from '../tools/resolver.js';
import type { AgentCatalog, AgentDefinition } from './catalog.js';
import { TenantVars } from './vars.js';

export async function buildAgent(def: AgentDefinition, catalog: AgentCatalog): Promise<Agent> {
  const mcpServers = await catalog.mcpServers(def.tenantId);
  const vars = new TenantVars(await catalog.vars(def.tenantId));
  const resolved: ToolList = [];
  for (const ref of def.tools) {
    const tools = resolveTool(ref, mcpServers, vars);
    resolved.push(...tools);
  }
  return new Agent({
    model: resolveModel(def.model, vars),
    systemPrompt: def.systemPrompt,
    tools: resolved,
  });
}
