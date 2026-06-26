import { OpenAIModel } from '@strands-agents/sdk/models/openai';

import { OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL_ID } from '../config.js';

export function loadOpenAIModel(): OpenAIModel {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required when MODEL_PROVIDER=openai');
  }
  return new OpenAIModel({
    api: 'chat',
    modelId: OPENAI_MODEL_ID,
    apiKey: OPENAI_API_KEY,
    maxTokens: 4096,
    temperature: 0.7,
    ...(OPENAI_BASE_URL ? { clientConfig: { baseURL: OPENAI_BASE_URL } } : {}),
  });
}
