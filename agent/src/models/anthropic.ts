import { AnthropicModel } from '@strands-agents/sdk/models/anthropic';

import type { AnthropicModelDef } from '../agents/catalog.js';
import type { TenantVars } from '../agents/vars.js';

export function loadAnthropicModel(def: AnthropicModelDef, vars: TenantVars): AnthropicModel {
  return new AnthropicModel({
    modelId: def.id,
    apiKey: vars.interpolate(def.apiKey),
    maxTokens: def.maxTokens ?? 4096,
    temperature: def.temperature ?? 0.7,
  });
}
