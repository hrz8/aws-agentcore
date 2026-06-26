import { Agent, BedrockModel } from '@strands-agents/sdk';

import { AWS_REGION, BEDROCK_MODEL_ID } from '../config.js';

const SIMPLE_AGENT_SYSTEM_PROMPT = `You are a helpful assistant. Keep replies concise and friendly.`;

export function createSimpleAgent(): Agent {
  return new Agent({
    model: new BedrockModel({
      region: AWS_REGION,
      modelId: BEDROCK_MODEL_ID,
      maxTokens: 4096,
      temperature: 0.7,
    }),
    systemPrompt: SIMPLE_AGENT_SYSTEM_PROMPT,
    tools: [],
  });
}
