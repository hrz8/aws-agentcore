import type { Model } from '@strands-agents/sdk';

import type { ModelDef } from '@repo/registry';
import { ModelProvider, TenantVars } from '@repo/registry';
import { loadAnthropicModel } from './anthropic.js';
import { loadBedrockModel } from './bedrock.js';
import { loadOpenAIModel } from './openai.js';

export function resolveModel(def: ModelDef, vars: TenantVars): Model {
  switch (def.provider) {
    case ModelProvider.Bedrock:   return loadBedrockModel(def.bedrock, vars);
    case ModelProvider.OpenAI:    return loadOpenAIModel(def.openai, vars);
    case ModelProvider.Anthropic: return loadAnthropicModel(def.anthropic, vars);
  }
}
