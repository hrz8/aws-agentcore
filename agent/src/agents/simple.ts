import { Agent } from '@strands-agents/sdk';

import { loadModel } from '../models/index.js';

const SIMPLE_AGENT_SYSTEM_PROMPT = `You are a helpful assistant. Keep replies concise and friendly.`;

export function createSimpleAgent(): Agent {
  return new Agent({
    model: loadModel(),
    systemPrompt: SIMPLE_AGENT_SYSTEM_PROMPT,
    tools: [],
  });
}
