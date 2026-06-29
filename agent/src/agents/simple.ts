import { Agent, Tool } from '@strands-agents/sdk';

import { KB_CONFIG } from '../config.js';
import { loadModel } from '../models/index.js';
import { createSearchDocumentsTool } from '../tools/search-documents.js';
import { createSearchWebTool } from '../tools/search-web.js';
import { convertTemperatureTool } from '../tools/temperature.js';

const SIMPLE_AGENT_SYSTEM_PROMPT = `You are a helpful assistant. Keep replies concise and friendly.

When the user asks to convert a temperature between Celsius and Fahrenheit, use the convert_temperature tool — do not compute it from memory.

When the user asks about something that might be in their uploaded documents (contracts, notes, manuals, policies, reports, anything they've shared), use the search_documents tool to find relevant passages, then answer from those passages and cite the source file. If search_documents returns no results, say so plainly rather than guessing.

When the user asks about something that might be on the websites we've indexed, use the search_web tool. Cite the source URL. If search_web returns no results, say so plainly.`;

export function createSimpleAgent(): Agent {
  return new Agent({
    model: loadModel(),
    systemPrompt: SIMPLE_AGENT_SYSTEM_PROMPT,
    tools: buildTools(),
  });
}

function buildTools(): Tool[] {
  const tools: Tool[] = [convertTemperatureTool];

  if (!KB_CONFIG) {
    console.warn('[agent] KB env not configured; search_documents/search_web tools not registered');
    return tools;
  }

  tools.push(createSearchDocumentsTool({
    kbId: KB_CONFIG.kbId,
    agentIds: [KB_CONFIG.agentId],
  }));

  if (KB_CONFIG.webDataSourceId) {
    tools.push(createSearchWebTool({
      kbId: KB_CONFIG.kbId,
      webDataSourceId: KB_CONFIG.webDataSourceId,
    }));
  }

  return tools;
}
