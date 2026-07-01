import type { Tool } from '@strands-agents/sdk';

import { KB_CONFIG } from '../config.js';
import { createSearchDocumentsTool } from './search-documents.js';
import { createSearchWebTool } from './search-web.js';

export function buildBaseTools(): Tool[] {
  const tools: Tool[] = [];

  if (!KB_CONFIG) {
    console.warn('[agent] KB env not configured; search_documents/search_web tools not registered');
    return tools;
  }

  tools.push(createSearchDocumentsTool({
    kbId: KB_CONFIG.kbId,
    tenantId: KB_CONFIG.tenantId,
    agentIds: [KB_CONFIG.agentId],
  }));

  if (KB_CONFIG.webDataSourceId) {
    tools.push(createSearchWebTool({
      kbId: KB_CONFIG.kbId,
      tenantId: KB_CONFIG.tenantId,
      agentIds: [KB_CONFIG.agentId],
    }));
  }

  return tools;
}
