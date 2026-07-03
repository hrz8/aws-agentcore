import { OpenAIModel } from '@strands-agents/sdk/models/openai';

import type { OpenAIModelDef } from '@repo/registry';
import { TenantVars } from '@repo/registry';

export function loadOpenAIModel(def: OpenAIModelDef, vars: TenantVars): OpenAIModel {
  return new OpenAIModel({
    api: 'chat',
    modelId: def.id,
    apiKey: vars.interpolate(def.apiKey),
    maxTokens: def.maxTokens ?? 4096,
    temperature: def.temperature ?? 0.7,
    ...(def.baseUrl
      ? {
        clientConfig: {
          baseURL: def.baseUrl,
        }
      }
      : {}
    ),
  });
}
