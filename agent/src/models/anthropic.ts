import { AnthropicModel } from '@strands-agents/sdk/models/anthropic';

import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL_ID } from '../config.js';

export function loadAnthropicModel(): AnthropicModel {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required when MODEL_PROVIDER=anthropic');
  }
  return new AnthropicModel({
    modelId: ANTHROPIC_MODEL_ID,
    apiKey: ANTHROPIC_API_KEY,
    maxTokens: 4096,
    temperature: 0.7,
  });
}
