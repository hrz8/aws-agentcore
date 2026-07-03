import { describe, expect, it } from 'vitest';

import {
  AgentRowSchema,
  AnthropicModelSchema,
  BedrockCredentialsSchema,
  BedrockModelSchema,
  McpAuthSchema,
  McpServerSchema,
  ModelSchema,
  OpenAIModelSchema,
  SLUG_REGEX,
  SlugSchema,
  TOOL_REF_REGEX,
  ToolRefSchema,
  UUID_REGEX,
  UuidSchema,
  VERSION_REGEX,
  VarSchema,
  VersionSchema,
} from '../src/index.ts';

const VALID_UUID = '00000000-0000-4000-8000-000000000000';

describe('regexes', () => {
  describe('UUID_REGEX', () => {
    it('accepts canonical UUIDs (both cases)', () => {
      expect(UUID_REGEX.test(VALID_UUID)).toBe(true);
      expect(UUID_REGEX.test(VALID_UUID.toUpperCase())).toBe(true);
    });
    it('rejects non-UUID shapes', () => {
      expect(UUID_REGEX.test('not-a-uuid')).toBe(false);
      expect(UUID_REGEX.test('')).toBe(false);
      expect(UUID_REGEX.test(`${VALID_UUID}-extra`)).toBe(false);
    });
  });

  describe('SLUG_REGEX', () => {
    it.each([
      ['tenant-a', true],
      ['a1', true],
      ['a-1-2-3', true],
      ['ab', true],
      ['A-cap', false],       // uppercase
      ['-leading', false],    // leading dash
      ['trailing-', false],   // trailing dash
      ['a', false],           // too short (min 2 with tail chars)
      ['a_underscore', false],
      ['', false],
    ])('SLUG_REGEX.test(%j) === %s', (value, expected) => {
      expect(SLUG_REGEX.test(value)).toBe(expected);
    });
  });

  describe('VERSION_REGEX', () => {
    it.each([
      ['1.0.0', true],
      ['v1', true],
      ['dev', true],
      ['1_0_0', true],
      ['0-9.dev', true],
      ['.leading', false],
      ['-leading', false],
      ['', false],
    ])('VERSION_REGEX.test(%j) === %s', (value, expected) => {
      expect(VERSION_REGEX.test(value)).toBe(expected);
    });
  });

  describe('TOOL_REF_REGEX', () => {
    it.each([
      ['builtin__get_time', true],
      ['builtin__a1_b2', true],
      ['mcp__slack', true],
      ['mcp__my-server', true],
      ['mcp__server-with-dash', true],
      ['not_prefixed', false],
      ['builtin__UPPER', false],
      ['builtin__', false],
    ])('TOOL_REF_REGEX.test(%j) === %s', (value, expected) => {
      expect(TOOL_REF_REGEX.test(value)).toBe(expected);
    });
  });
});

describe('primitive zod schemas', () => {
  it('UuidSchema round-trips', () => {
    expect(UuidSchema.safeParse(VALID_UUID).success).toBe(true);
    expect(UuidSchema.safeParse('nope').success).toBe(false);
  });
  it('SlugSchema round-trips', () => {
    expect(SlugSchema.safeParse('good-slug').success).toBe(true);
    expect(SlugSchema.safeParse('BAD').success).toBe(false);
  });
  it('VersionSchema round-trips', () => {
    expect(VersionSchema.safeParse('1.0.0').success).toBe(true);
    expect(VersionSchema.safeParse('.leading').success).toBe(false);
  });
  it('ToolRefSchema round-trips', () => {
    expect(ToolRefSchema.safeParse('builtin__now').success).toBe(true);
    expect(ToolRefSchema.safeParse('unknown').success).toBe(false);
  });
});

describe('VarSchema', () => {
  it('accepts plain variant', () => {
    expect(VarSchema.safeParse({ type: 'plain', value: 'v' }).success).toBe(true);
  });
  it('accepts secretmanager variant with region + jsonField', () => {
    expect(
      VarSchema.safeParse({
        type: 'secretmanager',
        secretId: 's',
        region: 'us-east-1',
        jsonField: 'password',
      }).success,
    ).toBe(true);
  });
  it('rejects unknown type', () => {
    expect(VarSchema.safeParse({ type: 'other', value: 'v' }).success).toBe(false);
  });
  it('rejects plain with missing value', () => {
    expect(VarSchema.safeParse({ type: 'plain' }).success).toBe(false);
  });
  it('rejects secretmanager with empty secretId', () => {
    expect(VarSchema.safeParse({ type: 'secretmanager', secretId: '' }).success).toBe(false);
  });
});

describe('McpAuthSchema', () => {
  it('accepts bearer', () => {
    expect(McpAuthSchema.safeParse({ kind: 'bearer', token: '{{ vars.tk }}' }).success).toBe(true);
  });
  it('accepts header', () => {
    expect(
      McpAuthSchema.safeParse({ kind: 'header', name: 'X-Api-Key', value: 'secret' }).success,
    ).toBe(true);
  });
  it('rejects unknown kind', () => {
    expect(McpAuthSchema.safeParse({ kind: 'basic', user: 'u' }).success).toBe(false);
  });
});

describe('McpServerSchema', () => {
  it('accepts url + optional auth', () => {
    expect(McpServerSchema.safeParse({ url: 'https://example.com/mcp' }).success).toBe(true);
    expect(
      McpServerSchema.safeParse({
        url: 'https://example.com/mcp',
        auth: { kind: 'bearer', token: 'x' },
      }).success,
    ).toBe(true);
  });
  it('rejects non-URL', () => {
    expect(McpServerSchema.safeParse({ url: 'not a url' }).success).toBe(false);
  });
});

describe('model schemas', () => {
  it('BedrockCredentialsSchema round-trips', () => {
    expect(
      BedrockCredentialsSchema.safeParse({ accessKeyId: 'a', secretAccessKey: 'b' }).success,
    ).toBe(true);
    expect(BedrockCredentialsSchema.safeParse({ accessKeyId: 'a' }).success).toBe(false);
  });
  it('BedrockModelSchema round-trips', () => {
    expect(BedrockModelSchema.safeParse({ id: 'claude-3' }).success).toBe(true);
    expect(BedrockModelSchema.safeParse({ id: '' }).success).toBe(false);
  });
  it('OpenAIModelSchema requires apiKey', () => {
    expect(OpenAIModelSchema.safeParse({ id: 'gpt-4', apiKey: 'x' }).success).toBe(true);
    expect(OpenAIModelSchema.safeParse({ id: 'gpt-4' }).success).toBe(false);
  });
  it('AnthropicModelSchema requires apiKey', () => {
    expect(AnthropicModelSchema.safeParse({ id: 'claude-3', apiKey: 'x' }).success).toBe(true);
    expect(AnthropicModelSchema.safeParse({ id: 'claude-3' }).success).toBe(false);
  });
  it('ModelSchema discriminates on provider', () => {
    expect(
      ModelSchema.safeParse({ provider: 'bedrock', bedrock: { id: 'x' } }).success,
    ).toBe(true);
    expect(
      ModelSchema.safeParse({ provider: 'openai', openai: { id: 'x', apiKey: 'k' } }).success,
    ).toBe(true);
    expect(
      ModelSchema.safeParse({ provider: 'anthropic', anthropic: { id: 'x', apiKey: 'k' } }).success,
    ).toBe(true);
    expect(ModelSchema.safeParse({ provider: 'other' }).success).toBe(false);
  });
});

describe('AgentRowSchema', () => {
  const validRow = {
    id: VALID_UUID,
    slug: 'my-agent',
    version: '1.0.0',
    enabled: true,
    description: 'test agent',
    systemPrompt: 'You are helpful.',
    model: { provider: 'bedrock', bedrock: { id: 'claude-3' } },
    tools: ['builtin__now', 'mcp__slack'],
  } as const;

  it('accepts a complete row', () => {
    expect(AgentRowSchema.safeParse(validRow).success).toBe(true);
  });
  it('rejects empty description', () => {
    expect(AgentRowSchema.safeParse({ ...validRow, description: '' }).success).toBe(false);
  });
  it('rejects malformed tool ref', () => {
    expect(AgentRowSchema.safeParse({ ...validRow, tools: ['bad'] }).success).toBe(false);
  });
  it('rejects non-UUID id', () => {
    expect(AgentRowSchema.safeParse({ ...validRow, id: 'not-uuid' }).success).toBe(false);
  });
});
