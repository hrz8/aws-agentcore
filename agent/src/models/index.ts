import type { Model } from '@strands-agents/sdk';

import { MODEL_PROVIDER } from '../config.js';
import { loadAnthropicModel } from './anthropic.js';
import { loadBedrockModel } from './bedrock.js';
import { loadOpenAIModel } from './openai.js';

export function loadModel(): Model {
  switch (MODEL_PROVIDER) {
    case 'bedrock':
      return loadBedrockModel();
    case 'openai':
      return loadOpenAIModel();
    case 'anthropic':
      return loadAnthropicModel();
  }
}
