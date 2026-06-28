import type { ToolList } from '@strands-agents/sdk';

import type { McpServerConfig, ToolRef } from '../agents/catalog.js';
import type { TenantVars } from '../agents/vars.js';
import { buildMcpClient } from './mcp.js';
import { BUILTIN_TOOLS, type BuiltinToolName } from './registry.js';

const BUILTIN_PREFIX = 'builtin__';
const MCP_PREFIX = 'mcp__';

export function resolveTool(
  ref: ToolRef,
  mcpServers: Record<string, McpServerConfig>,
  vars: TenantVars,
): ToolList {
  if (ref.startsWith(BUILTIN_PREFIX)) {
    const name = ref.slice(BUILTIN_PREFIX.length) as BuiltinToolName;
    const builtin = BUILTIN_TOOLS[name];
    if (!builtin) throw new Error(`unknown builtin tool: ${name}`);
    return [builtin];
  }

  if (ref.startsWith(MCP_PREFIX)) {
    const server = ref.slice(MCP_PREFIX.length);
    if (server.includes('__')) {
      throw new Error(
        `mcp tool ref "${ref}": granular tool selection isn't supported by Strands TS. `
        + `Use "mcp__${server.slice(0, server.indexOf('__'))}" to attach the whole server.`,
      );
    }
    const cfg = mcpServers[server];
    if (!cfg) throw new Error(`unknown mcp server: ${server}`);
    return [buildMcpClient(server, cfg, vars)];
  }

  throw new Error(`unrecognised tool ref: ${ref}`);
}
