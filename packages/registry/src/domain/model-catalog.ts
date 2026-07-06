import { ModelProvider, type ModelProvider as ModelProviderT } from './types.js';

export const BedrockModels = {
  // -- Anthropic (Global) --
  'Anthropic Sonnet 5 (Global)': 'global.anthropic.claude-sonnet-5',
  'Anthropic Sonnet 4.6 (Global)': 'global.anthropic.claude-sonnet-4-6',
  'Anthropic Sonnet 4.5 (Global)': 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
  'Anthropic Sonnet 4 (Global)': 'global.anthropic.claude-sonnet-4-20250514-v1:0',
  'Anthropic Haiku 4.5 (Global)': 'global.anthropic.claude-haiku-4-5-20251001-v1:0',

  // -- Anthropic (US) --
  'Anthropic Sonnet 5 (US)': 'us.anthropic.claude-sonnet-5',
  'Anthropic Sonnet 4.6 (US)': 'us.anthropic.claude-sonnet-4-6',
  'Anthropic Sonnet 4.5 (US)': 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
  'Anthropic Sonnet 4 (US)': 'us.anthropic.claude-sonnet-4-20250514-v1:0',
  'Anthropic Haiku 4.5 (US)': 'us.anthropic.claude-haiku-4-5-20251001-v1:0',

  // -- Amazon Nova --
  'Amazon Nova Premier (US)': 'us.amazon.nova-premier-v1:0',
  'Amazon Nova Pro (US)': 'us.amazon.nova-pro-v1:0',
  'Amazon Nova Lite 2 (Global)': 'global.amazon.nova-2-lite-v1:0',
  'Amazon Nova Lite (US)': 'us.amazon.nova-lite-v1:0',
  'Amazon Nova Micro (US)': 'us.amazon.nova-micro-v1:0',

  // -- OpenAI open-weight (hosted on Bedrock, single-region) --
  'OpenAI GPT-OSS 120B': 'openai.gpt-oss-120b-1:0',
  'OpenAI GPT-OSS 20B': 'openai.gpt-oss-20b-1:0',

  // -- Qwen (single-region) --
  'Qwen3 Next 80B': 'qwen.qwen3-next-80b-a3b',
  'Qwen3 VL 235B': 'qwen.qwen3-vl-235b-a22b',
  'Qwen3 Coder Next': 'qwen.qwen3-coder-next',
  'Qwen3 Coder 30B': 'qwen.qwen3-coder-30b-a3b-v1:0',
  'Qwen3 32B': 'qwen.qwen3-32b-v1:0',

  // -- DeepSeek --
  'DeepSeek R1 (US)': 'us.deepseek.r1-v1:0',
  'DeepSeek V3.2': 'deepseek.v3.2',

  // -- MiniMax (single-region) --
  'MiniMax M2.5': 'minimax.minimax-m2.5',
  'MiniMax M2.1': 'minimax.minimax-m2.1',
  'MiniMax M2': 'minimax.minimax-m2',
} as const;
export type BedrockModelId = typeof BedrockModels[keyof typeof BedrockModels];

export const OpenAIModels = {
  Gpt4o: 'gpt-4o',
  Gpt4oMini: 'gpt-4o-mini',
  O1: 'o1',
  O1Mini: 'o1-mini',
} as const;
export type OpenAIModelId = typeof OpenAIModels[keyof typeof OpenAIModels];

export const AnthropicModels = {
  ClaudeOpus48: 'claude-opus-4-8',
  ClaudeSonnet5: 'claude-sonnet-5',
  ClaudeHaiku45: 'claude-haiku-4-5-20251001',
} as const;
export type AnthropicModelId = typeof AnthropicModels[keyof typeof AnthropicModels];

export const MODELS_BY_PROVIDER = {
  [ModelProvider.Bedrock]: BedrockModels,
  [ModelProvider.OpenAI]: OpenAIModels,
  [ModelProvider.Anthropic]: AnthropicModels,
} as const satisfies Record<ModelProviderT, Readonly<Record<string, string>>>;
