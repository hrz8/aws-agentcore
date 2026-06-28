import type {
  AgentCatalog,
  AgentDefinition,
  McpServerConfig,
  Var,
} from '../catalog.js';

// Implement when there's a concrete need (multi-region, runtime catalog edits without redeploy, etc.).
export class DatabaseAgentCatalog implements AgentCatalog {
  async load(): Promise<void> {
    throw new Error(
      'DatabaseAgentCatalog: not yet implemented. '
      + 'Set CATALOG_SOURCE=yaml (the default) or implement this class.',
    );
  }

  async list(_tenantId: string): Promise<AgentDefinition[]> {
    throw notImplemented();
  }

  async get(_tenantId: string, _agentId: string): Promise<AgentDefinition | null> {
    throw notImplemented();
  }

  async mcpServers(_tenantId: string): Promise<Record<string, McpServerConfig>> {
    throw notImplemented();
  }

  async vars(_tenantId: string): Promise<Record<string, Var>> {
    throw notImplemented();
  }
}

function notImplemented(): Error {
  return new Error('DatabaseAgentCatalog: not yet implemented');
}
