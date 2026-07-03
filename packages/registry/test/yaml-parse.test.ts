import { describe, expect, it } from 'vitest';

import {
  idKey,
  parseRegistryYaml,
  slugKey,
  toIdentity,
  validateRegistryText,
  type ParseOptions,
} from '../src/index.ts';

const TENANT_ID = '00000000-0000-4000-8000-000000000001';
const AGENT_ID = '00000000-0000-4000-8000-000000000002';

const OPTS: ParseOptions = { allowedBuiltinTools: null };

// Small helper — produces the minimum registry YAML that parses cleanly.
// Callers can override sections by string-substituting the return value.
function minimalYaml(overrides: {
  tenantId?: string;
  tenantSlug?: string;
  agents?: string;
} = {}): string {
  const tenantId = overrides.tenantId ?? TENANT_ID;
  const tenantSlug = overrides.tenantSlug ?? 'acme';
  const agents = overrides.agents ?? [
    '    - id: ' + AGENT_ID,
    '      slug: greeter',
    '      version: "1.0.0"',
    '      enabled: true',
    '      description: says hi',
    '      systemPrompt: You are helpful.',
    '      model:',
    '        provider: bedrock',
    '        bedrock:',
    '          id: claude-3',
    '      tools: []',
  ].join('\n');

  return [
    'tenants:',
    `  - id: ${tenantId}`,
    `    slug: ${tenantSlug}`,
    '    name: Acme Corp',
    '    agents:',
    agents,
    '',
  ].join('\n');
}

describe('parseRegistryYaml — happy paths', () => {
  it('parses a minimal one-tenant one-agent registry', () => {
    const idx = parseRegistryYaml(minimalYaml(), OPTS);
    expect(idx.tenantsById.get(TENANT_ID)).toEqual({
      tenantId: TENANT_ID,
      tenantSlug: 'acme',
      tenantName: 'Acme Corp',
    });
    expect(idx.byIds.size).toBe(1);
    const def = idx.byIds.get(idKey(TENANT_ID, AGENT_ID, '1.0.0'));
    expect(def?.agentSlug).toBe('greeter');
    expect(def?.enabled).toBe(true);
  });

  it('falls back tenantName to slug when name absent', () => {
    const yaml = minimalYaml().replace('    name: Acme Corp\n', '');
    const idx = parseRegistryYaml(yaml, OPTS);
    expect(idx.tenantsById.get(TENANT_ID)?.tenantName).toBe('acme');
  });

  it('populates bySlugs index in parallel to byIds', () => {
    const idx = parseRegistryYaml(minimalYaml(), OPTS);
    const byId = idx.byIds.get(idKey(TENANT_ID, AGENT_ID, '1.0.0'));
    const bySlug = idx.bySlugs.get(slugKey('acme', 'greeter', '1.0.0'));
    expect(byId).toBe(bySlug);
  });

  it('populates byTenantId and byTenantSlug lists', () => {
    const idx = parseRegistryYaml(minimalYaml(), OPTS);
    expect(idx.byTenantId.get(TENANT_ID)).toHaveLength(1);
    expect(idx.byTenantSlug.get('acme')).toHaveLength(1);
  });

  it('empty mcpServers / vars default to {}', () => {
    const idx = parseRegistryYaml(minimalYaml(), OPTS);
    expect(idx.mcpByTenantId.get(TENANT_ID)).toEqual({});
    expect(idx.varsByTenantId.get(TENANT_ID)).toEqual({});
  });
});

describe('parseRegistryYaml — structural errors', () => {
  it('rejects duplicate tenant id', () => {
    const yaml = [
      'tenants:',
      `  - id: ${TENANT_ID}`,
      '    slug: alpha',
      '    agents:',
      '      - id: ' + AGENT_ID,
      '        slug: greeter',
      '        version: "1.0.0"',
      '        enabled: true',
      '        description: d',
      '        systemPrompt: s',
      '        model: {provider: bedrock, bedrock: {id: x}}',
      '        tools: []',
      `  - id: ${TENANT_ID}`,
      '    slug: beta',
      '    agents:',
      '      - id: ' + AGENT_ID,
      '        slug: greeter',
      '        version: "1.0.0"',
      '        enabled: true',
      '        description: d',
      '        systemPrompt: s',
      '        model: {provider: bedrock, bedrock: {id: x}}',
      '        tools: []',
    ].join('\n');
    expect(() => parseRegistryYaml(yaml, OPTS)).toThrow(/duplicate tenant id/);
  });

  it('rejects duplicate tenant slug', () => {
    const yaml = [
      'tenants:',
      `  - id: ${TENANT_ID}`,
      '    slug: acme',
      '    agents:',
      '      - id: ' + AGENT_ID,
      '        slug: greeter',
      '        version: "1"',
      '        enabled: true',
      '        description: d',
      '        systemPrompt: s',
      '        model: {provider: bedrock, bedrock: {id: x}}',
      '        tools: []',
      '  - id: 00000000-0000-4000-8000-00000000000a',
      '    slug: acme',
      '    agents:',
      '      - id: 00000000-0000-4000-8000-00000000000b',
      '        slug: greeter',
      '        version: "1"',
      '        enabled: true',
      '        description: d',
      '        systemPrompt: s',
      '        model: {provider: bedrock, bedrock: {id: x}}',
      '        tools: []',
    ].join('\n');
    expect(() => parseRegistryYaml(yaml, OPTS)).toThrow(/duplicate tenant slug/);
  });

  it('rejects duplicate (agent, version)', () => {
    const dup = [
      `    - id: ${AGENT_ID}`,
      '      slug: greeter',
      '      version: "1.0.0"',
      '      enabled: true',
      '      description: d',
      '      systemPrompt: s',
      '      model: {provider: bedrock, bedrock: {id: x}}',
      '      tools: []',
      `    - id: ${AGENT_ID}`,
      '      slug: greeter',
      '      version: "1.0.0"',
      '      enabled: false',
      '      description: d',
      '      systemPrompt: s',
      '      model: {provider: bedrock, bedrock: {id: x}}',
      '      tools: []',
    ].join('\n');
    expect(() => parseRegistryYaml(minimalYaml({ agents: dup }), OPTS))
      .toThrow(/duplicate \(agent, version\)/);
  });

  it('rejects >1 enabled version of the same agent', () => {
    const twoEnabled = [
      `    - id: ${AGENT_ID}`,
      '      slug: greeter',
      '      version: "1.0.0"',
      '      enabled: true',
      '      description: d',
      '      systemPrompt: s',
      '      model: {provider: bedrock, bedrock: {id: x}}',
      '      tools: []',
      `    - id: ${AGENT_ID}`,
      '      slug: greeter',
      '      version: "2.0.0"',
      '      enabled: true',
      '      description: d',
      '      systemPrompt: s',
      '      model: {provider: bedrock, bedrock: {id: x}}',
      '      tools: []',
    ].join('\n');
    expect(() => parseRegistryYaml(minimalYaml({ agents: twoEnabled }), OPTS))
      .toThrow(/2 enabled versions.*exactly 1 required/);
  });

  it('rejects 0 enabled versions of an agent', () => {
    const noEnabled = [
      `    - id: ${AGENT_ID}`,
      '      slug: greeter',
      '      version: "1.0.0"',
      '      enabled: false',
      '      description: d',
      '      systemPrompt: s',
      '      model: {provider: bedrock, bedrock: {id: x}}',
      '      tools: []',
    ].join('\n');
    expect(() => parseRegistryYaml(minimalYaml({ agents: noEnabled }), OPTS))
      .toThrow(/no enabled version.*exactly 1 required/);
  });

  it('rejects agent id mapping to two slugs', () => {
    const twoSlugs = [
      `    - id: ${AGENT_ID}`,
      '      slug: greeter',
      '      version: "1.0.0"',
      '      enabled: true',
      '      description: d',
      '      systemPrompt: s',
      '      model: {provider: bedrock, bedrock: {id: x}}',
      '      tools: []',
      `    - id: ${AGENT_ID}`,
      '      slug: farewell',
      '      version: "2.0.0"',
      '      enabled: false',
      '      description: d',
      '      systemPrompt: s',
      '      model: {provider: bedrock, bedrock: {id: x}}',
      '      tools: []',
    ].join('\n');
    expect(() => parseRegistryYaml(minimalYaml({ agents: twoSlugs }), OPTS))
      .toThrow(/agent id .* maps to two different slugs/);
  });

  it('rejects agent slug mapping to two ids', () => {
    const twoIds = [
      `    - id: ${AGENT_ID}`,
      '      slug: greeter',
      '      version: "1.0.0"',
      '      enabled: true',
      '      description: d',
      '      systemPrompt: s',
      '      model: {provider: bedrock, bedrock: {id: x}}',
      '      tools: []',
      '    - id: 00000000-0000-4000-8000-000000000099',
      '      slug: greeter',
      '      version: "2.0.0"',
      '      enabled: false',
      '      description: d',
      '      systemPrompt: s',
      '      model: {provider: bedrock, bedrock: {id: x}}',
      '      tools: []',
    ].join('\n');
    expect(() => parseRegistryYaml(minimalYaml({ agents: twoIds }), OPTS))
      .toThrow(/agent slug "greeter" maps to two different ids/);
  });
});

describe('parseRegistryYaml — tool ref validation', () => {
  it('rejects granular mcp__server__tool form', () => {
    const yaml = minimalYaml({
      agents: [
        `    - id: ${AGENT_ID}`,
        '      slug: greeter',
        '      version: "1"',
        '      enabled: true',
        '      description: d',
        '      systemPrompt: s',
        '      model: {provider: bedrock, bedrock: {id: x}}',
        '      tools: ["mcp__slack__post"]',
      ].join('\n'),
    });
    expect(() => parseRegistryYaml(yaml, OPTS)).toThrow(/granular.*mcp__/);
  });

  it('rejects mcp__ ref to undeclared server', () => {
    const yaml = minimalYaml({
      agents: [
        `    - id: ${AGENT_ID}`,
        '      slug: greeter',
        '      version: "1"',
        '      enabled: true',
        '      description: d',
        '      systemPrompt: s',
        '      model: {provider: bedrock, bedrock: {id: x}}',
        '      tools: ["mcp__slack"]',
      ].join('\n'),
    });
    expect(() => parseRegistryYaml(yaml, OPTS)).toThrow(/unknown mcp server: slack/);
  });

  it('rejects builtin__ when allowedBuiltinTools set and name absent', () => {
    const yaml = minimalYaml({
      agents: [
        `    - id: ${AGENT_ID}`,
        '      slug: greeter',
        '      version: "1"',
        '      enabled: true',
        '      description: d',
        '      systemPrompt: s',
        '      model: {provider: bedrock, bedrock: {id: x}}',
        '      tools: ["builtin__unknown"]',
      ].join('\n'),
    });
    expect(() =>
      parseRegistryYaml(yaml, { allowedBuiltinTools: new Set(['get_time']) }),
    ).toThrow(/unknown builtin tool: unknown/);
  });

  it('accepts builtin__ when allowedBuiltinTools is null (open policy)', () => {
    const yaml = minimalYaml({
      agents: [
        `    - id: ${AGENT_ID}`,
        '      slug: greeter',
        '      version: "1"',
        '      enabled: true',
        '      description: d',
        '      systemPrompt: s',
        '      model: {provider: bedrock, bedrock: {id: x}}',
        '      tools: ["builtin__anything"]',
      ].join('\n'),
    });
    expect(() => parseRegistryYaml(yaml, OPTS)).not.toThrow();
  });
});

describe('parseRegistryYaml — var-ref validation', () => {
  it('accepts model.openai.apiKey pointing at a declared var', () => {
    const yaml = [
      'tenants:',
      `  - id: ${TENANT_ID}`,
      '    slug: acme',
      '    vars:',
      '      openaiKey: {type: plain, value: sk-xxx}',
      '    agents:',
      `      - id: ${AGENT_ID}`,
      '        slug: greeter',
      '        version: "1"',
      '        enabled: true',
      '        description: d',
      '        systemPrompt: s',
      '        model:',
      '          provider: openai',
      '          openai: {id: gpt-4, apiKey: "{{ vars.openaiKey }}"}',
      '        tools: []',
    ].join('\n');
    expect(() => parseRegistryYaml(yaml, OPTS)).not.toThrow();
  });

  it('rejects var ref to undeclared name', () => {
    const yaml = [
      'tenants:',
      `  - id: ${TENANT_ID}`,
      '    slug: acme',
      '    agents:',
      `      - id: ${AGENT_ID}`,
      '        slug: greeter',
      '        version: "1"',
      '        enabled: true',
      '        description: d',
      '        systemPrompt: s',
      '        model:',
      '          provider: openai',
      '          openai: {id: gpt-4, apiKey: "{{ vars.missing }}"}',
      '        tools: []',
    ].join('\n');
    expect(() => parseRegistryYaml(yaml, OPTS)).toThrow(/unknown var "missing"/);
  });

  it('rejects malformed template block in an apiKey field', () => {
    const yaml = [
      'tenants:',
      `  - id: ${TENANT_ID}`,
      '    slug: acme',
      '    agents:',
      `      - id: ${AGENT_ID}`,
      '        slug: greeter',
      '        version: "1"',
      '        enabled: true',
      '        description: d',
      '        systemPrompt: s',
      '        model:',
      '          provider: openai',
      '          openai: {id: gpt-4, apiKey: "{{ notvars }}"}',
      '        tools: []',
    ].join('\n');
    expect(() => parseRegistryYaml(yaml, OPTS))
      .toThrow(/openai\.apiKey.*template block/);
  });

  it('rejects unknown var in mcpServers auth', () => {
    const yaml = [
      'tenants:',
      `  - id: ${TENANT_ID}`,
      '    slug: acme',
      '    mcpServers:',
      '      slack:',
      '        url: https://slack.example/mcp',
      '        auth: {kind: bearer, token: "{{ vars.tk }}"}',
      '    agents:',
      `      - id: ${AGENT_ID}`,
      '        slug: greeter',
      '        version: "1"',
      '        enabled: true',
      '        description: d',
      '        systemPrompt: s',
      '        model: {provider: bedrock, bedrock: {id: x}}',
      '        tools: []',
    ].join('\n');
    expect(() => parseRegistryYaml(yaml, OPTS)).toThrow(/unknown var "tk"/);
  });
});

describe('validateRegistryText', () => {
  it('returns { ok: true, parsed } for a valid registry', () => {
    const result = validateRegistryText(minimalYaml(), OPTS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.parsed.tenants).toHaveLength(1);
    }
  });

  it('returns yaml-parse error for malformed YAML', () => {
    const result = validateRegistryText('tenants: [::', OPTS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('yaml-parse');
    }
  });

  it('returns schema error for structurally wrong data', () => {
    const result = validateRegistryText('tenants: []', OPTS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('schema');
    }
  });

  it('returns semantic error for duplicate agent versions', () => {
    const dup = [
      `    - id: ${AGENT_ID}`,
      '      slug: greeter',
      '      version: "1"',
      '      enabled: true',
      '      description: d',
      '      systemPrompt: s',
      '      model: {provider: bedrock, bedrock: {id: x}}',
      '      tools: []',
      `    - id: ${AGENT_ID}`,
      '      slug: greeter',
      '      version: "1"',
      '      enabled: false',
      '      description: d',
      '      systemPrompt: s',
      '      model: {provider: bedrock, bedrock: {id: x}}',
      '      tools: []',
    ].join('\n');
    const result = validateRegistryText(minimalYaml({ agents: dup }), OPTS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('semantic');
    }
  });
});

describe('key helpers', () => {
  it('idKey composes tenant/agent/version', () => {
    expect(idKey('t', 'a', 'v')).toBe('t/a/v');
  });
  it('slugKey composes tenantSlug/agentSlug/version', () => {
    expect(slugKey('acme', 'greeter', '1.0.0')).toBe('acme/greeter/1.0.0');
  });
  it('toIdentity strips model + systemPrompt + tools', () => {
    const idx = parseRegistryYaml(minimalYaml(), OPTS);
    const def = idx.byIds.get(idKey(TENANT_ID, AGENT_ID, '1.0.0'));
    if (!def) throw new Error('missing def');
    const identity = toIdentity(def);
    expect(identity).toEqual({
      tenantId: TENANT_ID,
      tenantSlug: 'acme',
      agentId: AGENT_ID,
      agentSlug: 'greeter',
      version: '1.0.0',
      enabled: true,
      description: 'says hi',
    });
    expect('systemPrompt' in identity).toBe(false);
    expect('model' in identity).toBe(false);
  });
});
