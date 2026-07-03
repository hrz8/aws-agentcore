import type { Model } from '@strands-agents/sdk';

import type { ModelDef } from '@repo/registry';
import { TenantVars } from '@repo/registry';
import { loadAnthropicModel } from './anthropic.js';
import { loadBedrockModel } from './bedrock.js';
import { loadOpenAIModel } from './openai.js';

export function resolveModel(def: ModelDef, vars: TenantVars): Model {
  switch (def.provider) {
    case 'bedrock':   return loadBedrockModel(def.bedrock, vars);
    case 'openai':    return loadOpenAIModel(def.openai, vars);
    case 'anthropic': return loadAnthropicModel(def.anthropic, vars);
  }
}
