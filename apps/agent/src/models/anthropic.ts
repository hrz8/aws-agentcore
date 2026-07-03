import { AnthropicModel } from '@strands-agents/sdk/models/anthropic';

import type { AnthropicModelDef } from '@repo/registry';
import { TenantVars } from '@repo/registry';

export function loadAnthropicModel(def: AnthropicModelDef, vars: TenantVars): AnthropicModel {
  return new AnthropicModel({
    modelId: def.id,
    apiKey: vars.interpolate(def.apiKey),
    maxTokens: def.maxTokens ?? 4096,
    temperature: def.temperature ?? 0.7,
  });
}
