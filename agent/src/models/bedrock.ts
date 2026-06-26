import { BedrockModel } from '@strands-agents/sdk/models/bedrock';

import { AWS_REGION, BEDROCK_MODEL_ID } from '../config.js';

export function loadBedrockModel(): BedrockModel {
  return new BedrockModel({
    region: AWS_REGION,
    modelId: BEDROCK_MODEL_ID,
    maxTokens: 4096,
    temperature: 0.7,
  });
}
