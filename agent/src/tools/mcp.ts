import { McpClient } from '@strands-agents/sdk';

import type { McpServerConfig } from '../agents/catalog.js';
import type { TenantVars } from '../agents/vars.js';

// Config assembly only - Strands constructs the StreamableHTTP transport from `url` and connects lazily on first tool use.
export function buildMcpClient(
  serverName: string,
  config: McpServerConfig,
  vars: TenantVars,
): McpClient {
  const headers = authToHeaders(config, vars);
  return new McpClient({
    applicationName: `agentcore-runtime/mcp/${serverName}`,
    url: config.url,
    ...(headers ? { headers } : {}),
  });
}

function authToHeaders(
  config: McpServerConfig,
  vars: TenantVars,
): Record<string, string> | undefined {
  if (!config.auth) return undefined;
  if (config.auth.kind === 'bearer') {
    return { Authorization: `Bearer ${vars.interpolate(config.auth.token)}` };
  }
  return { [config.auth.name]: vars.interpolate(config.auth.value) };
}
