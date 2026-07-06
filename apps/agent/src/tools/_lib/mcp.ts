import { McpClient } from '@strands-agents/sdk';

import type { McpServerConfig } from '@repo/registry';
import { McpAuthKind, TenantVars } from '@repo/registry';

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
  if (config.auth.kind === McpAuthKind.Bearer) {
    return { Authorization: `Bearer ${vars.interpolate(config.auth.token)}` };
  }
  return { [config.auth.name]: vars.interpolate(config.auth.value) };
}
