import { BedrockModel } from '@strands-agents/sdk/models/bedrock';

import type { BedrockModelDef } from '@repo/registry';
import { TenantVars } from '@repo/registry';
import { AWS_REGION } from '../config.js';

export function loadBedrockModel(def: BedrockModelDef, vars: TenantVars): BedrockModel {
  const region = def.region ?? AWS_REGION;

  if (!def.credentials) {
    return new BedrockModel({
      region,
      modelId: def.id,
      maxTokens: def.maxTokens ?? 4096,
      temperature: def.temperature ?? 0.7,
    });
  }

  const c = def.credentials;
  const accessKeyId = vars.interpolate(c.accessKeyId);
  const secretAccessKey = vars.interpolate(c.secretAccessKey);
  const sessionToken = vars.interpolateOptional(c.sessionToken);

  return new BedrockModel({
    region,
    modelId: def.id,
    maxTokens: def.maxTokens ?? 4096,
    temperature: def.temperature ?? 0.7,
    clientConfig: {
      credentials: {
        accessKeyId,
        secretAccessKey,
        ...(sessionToken ? { sessionToken } : {}),
      },
    },
  });
}
