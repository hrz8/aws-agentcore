import { beforeEach, describe, expect, it } from 'vitest';

import { S3YamlAgentRepo } from '../src/adapters/yaml/agents.ts';
import { parseRegistryYaml, type ParseOptions, type RegistryIndexes } from '../src/adapters/yaml/parse.ts';
import { ModelProvider } from '../src/domain/index.ts';
import { AgentNotFoundError, RegistryValidationError } from '../src/errors.ts';
import { validateRegistryText } from '../src/adapters/yaml/parse.ts';

const TENANT_ID = '00000000-0000-4000-8000-000000000001';
const AGENT_ID = '00000000-0000-4000-8000-000000000002';
const OPTS: ParseOptions = { allowedBuiltinTools: null };

const INITIAL_YAML = [
  '# top-of-file comment (preservation check)',
  'tenants:',
  `  - id: ${TENANT_ID}`,
  '    slug: acme',
  '    name: Acme Corp',
  '    agents:',
  `      - id: ${AGENT_ID}`,
  '        slug: greeter',
  '        version: "1.0.0"',
  '        enabled: true',
  '        description: says hi',
  '        # keep this inline comment',
  '        systemPrompt: You are helpful.',
  '        model:',
  '          provider: bedrock',
  '          bedrock:',
  '            id: claude-3',
  '        tools: []',
  '',
].join('\n');

// Minimal in-memory harness that mirrors the S3YamlRegistryRepository facade
// well enough for updateFields: keeps a mutable YAML string and a reparsed
// index, and validates writes just like the real S3 backend.
function makeHarness() {
  let text = INITIAL_YAML;
  let indexes: RegistryIndexes = parseRegistryYaml(text, OPTS);

  const repo = new S3YamlAgentRepo({
    getIndex: () => indexes,
    readRaw: async () => ({ text, etag: 'etag-0' }),
    writeRaw: async (next: string) => {
      const result = validateRegistryText(next, OPTS);
      if (!result.ok) {
        throw new RegistryValidationError(result.error.message);
      }
      text = next;
      indexes = parseRegistryYaml(next, OPTS);
      return { etag: `etag-${Date.now()}` };
    },
    validate: (t) => validateRegistryText(t, OPTS),
  });

  return {
    repo,
    getText: () => text,
  };
}

describe('S3YamlAgentRepo.updateFields', () => {
  let h: ReturnType<typeof makeHarness>;
  beforeEach(() => { h = makeHarness(); });

  it('patches tools array on the correct version', async () => {
    const result = await h.repo.updateFields({
      tenantId: TENANT_ID,
      agentId: AGENT_ID,
      version: '1.0.0',
      patch: { tools: ['builtin__convert_temperature'] },
    });
    expect(result.target.tools).toEqual(['builtin__convert_temperature']);
  });

  it('patches description on the correct version', async () => {
    const result = await h.repo.updateFields({
      tenantId: TENANT_ID,
      agentId: AGENT_ID,
      version: '1.0.0',
      patch: { description: 'Weather specialist — forecasts & conversions' },
    });
    expect(result.target.description).toBe('Weather specialist — forecasts & conversions');
  });

  it('patches systemPrompt on the correct version', async () => {
    const result = await h.repo.updateFields({
      tenantId: TENANT_ID,
      agentId: AGENT_ID,
      version: '1.0.0',
      patch: { systemPrompt: 'You are extremely helpful.' },
    });
    expect(result.target.systemPrompt).toBe('You are extremely helpful.');
    expect(result.etag).toMatch(/^etag-/);
  });

  it('patches model and replaces the entire subtree', async () => {
    const result = await h.repo.updateFields({
      tenantId: TENANT_ID,
      agentId: AGENT_ID,
      version: '1.0.0',
      patch: {
        model: {
          provider: ModelProvider.Bedrock,
          bedrock: { id: 'claude-4', region: 'us-west-2', maxTokens: 8192 },
        },
      },
    });
    expect(result.target.model).toEqual({
      provider: 'bedrock',
      bedrock: { id: 'claude-4', region: 'us-west-2', maxTokens: 8192 },
    });
  });

  it('preserves comments in the rewritten YAML', async () => {
    await h.repo.updateFields({
      tenantId: TENANT_ID,
      agentId: AGENT_ID,
      version: '1.0.0',
      patch: { systemPrompt: 'Anew.' },
    });
    const nextText = h.getText();
    expect(nextText).toContain('# top-of-file comment (preservation check)');
    expect(nextText).toContain('# keep this inline comment');
    expect(nextText).toContain('Anew.');
  });

  it('throws AgentNotFoundError when the version is missing', async () => {
    await expect(
      h.repo.updateFields({
        tenantId: TENANT_ID,
        agentId: AGENT_ID,
        version: '9.9.9',
        patch: { systemPrompt: 'x' },
      }),
    ).rejects.toBeInstanceOf(AgentNotFoundError);
  });

  it('throws AgentNotFoundError when the tenant is missing', async () => {
    await expect(
      h.repo.updateFields({
        tenantId: '00000000-0000-4000-8000-0000000000ff',
        agentId: AGENT_ID,
        version: '1.0.0',
        patch: { systemPrompt: 'x' },
      }),
    ).rejects.toBeInstanceOf(AgentNotFoundError);
  });

  it('rejects empty patch objects', async () => {
    await expect(
      h.repo.updateFields({
        tenantId: TENANT_ID,
        agentId: AGENT_ID,
        version: '1.0.0',
        patch: {},
      }),
    ).rejects.toBeInstanceOf(RegistryValidationError);
  });

  it('surfaces schema violations via writeRaw → RegistryValidationError', async () => {
    await expect(
      h.repo.updateFields({
        tenantId: TENANT_ID,
        agentId: AGENT_ID,
        version: '1.0.0',
        // Empty systemPrompt violates z.string().min(1) in AgentRowSchema.
        patch: { systemPrompt: '' },
      }),
    ).rejects.toBeInstanceOf(RegistryValidationError);
  });
});
