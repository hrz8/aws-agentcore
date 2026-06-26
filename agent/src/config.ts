export const PORT = Number.parseInt(process.env.PORT ?? '8080', 10);

// ---- Model provider ----
export type ModelProvider = 'bedrock' | 'openai' | 'anthropic';

function parseModelProvider(value: string | undefined): ModelProvider {
  if (value === 'bedrock' || value === 'openai' || value === 'anthropic') return value;
  return 'bedrock';
}

export const MODEL_PROVIDER: ModelProvider = parseModelProvider(process.env.MODEL_PROVIDER);

// ---- Bedrock ----
export const AWS_REGION = process.env.AWS_REGION ?? 'us-east-1';
export const BEDROCK_MODEL_ID =
  process.env.BEDROCK_MODEL_ID ?? 'global.anthropic.claude-sonnet-4-6';

// ---- OpenAI / OpenAI-compatible gateway (OpenRouter, Bifrost, LiteLLM, ...) ----
export const OPENAI_MODEL_ID = process.env.OPENAI_MODEL_ID ?? 'gpt-5';
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;

// ---- Anthropic direct API ----
export const ANTHROPIC_MODEL_ID =
  process.env.ANTHROPIC_MODEL_ID ?? 'claude-sonnet-4-6';
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
