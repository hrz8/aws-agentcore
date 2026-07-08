import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ParseOptions } from '../src/index.ts';
import {
  LocalYamlRegistryRepository,
  LocalYamlSource,
} from '../src/adapters/yaml/local-source.ts';

const OPTS: ParseOptions = { allowedBuiltinTools: null };

const TENANT_ID = '00000000-0000-4000-8000-000000000001';
const AGENT_ID = '00000000-0000-4000-8000-000000000002';

function minimalYaml(overrides: { agentSlug?: string; version?: string } = {}): string {
  const slug = overrides.agentSlug ?? 'greeter';
  const version = overrides.version ?? '1.0.0';
  return [
    'tenants:',
    `  - id: ${TENANT_ID}`,
    '    slug: acme',
    '    vars: {}',
    '    mcpServers: {}',
    '    agents:',
    `      - id: ${AGENT_ID}`,
    `        slug: ${slug}`,
    `        version: "${version}"`,
    '        enabled: true',
    '        description: says hi',
    '        systemPrompt: You are helpful.',
    '        model:',
    '          provider: bedrock',
    '          bedrock:',
    '            id: claude-3',
    '        tools: []',
    '',
  ].join('\n');
}

let dir: string;
let path: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'local-yaml-test-'));
  path = join(dir, 'agents.yaml');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('LocalYamlSource', () => {
  it('reads back what was written', async () => {
    const source = new LocalYamlSource({ path });
    const text = minimalYaml();
    await source.write(text);
    const read = await source.read();
    expect(read.kind).toBe('ok');
    if (read.kind === 'ok') {
      expect(read.text).toBe(text);
      expect(read.etag).toBeUndefined();
    }
  });

  it('creates the parent directory when the path is a nested one', async () => {
    const nested = join(dir, 'nested', 'deeper', 'agents.yaml');
    const source = new LocalYamlSource({ path: nested });
    await source.write(minimalYaml());
    const raw = await readFile(nested, 'utf-8');
    expect(raw).toContain(TENANT_ID);
  });

  it('throws a clear error when the file does not exist on read', async () => {
    const source = new LocalYamlSource({ path });
    await expect(source.read()).rejects.toThrow(/registry missing/);
  });

  it('describe() returns file: prefix with absolute path', () => {
    const source = new LocalYamlSource({ path });
    expect(source.describe()).toBe(`file:${path}`);
  });
});

describe('LocalYamlRegistryRepository', () => {
  it('parses the file on refresh and exposes tenants + agents', async () => {
    const source = new LocalYamlSource({ path });
    await source.write(minimalYaml());

    const repo = new LocalYamlRegistryRepository({ path, parseOpts: OPTS });
    await repo.refresh();

    const tenants = await repo.tenants.list();
    expect(tenants).toHaveLength(1);
    expect(tenants[0]?.tenantId).toBe(TENANT_ID);

    const agents = await repo.agents.listByTenantId(TENANT_ID);
    expect(agents).toHaveLength(1);
    expect(agents[0]?.agentId).toBe(AGENT_ID);
    expect(agents[0]?.agentSlug).toBe('greeter');
  });

  it('refresh re-reads updated file content', async () => {
    const source = new LocalYamlSource({ path });
    await source.write(minimalYaml({ agentSlug: 'greeter' }));

    const repo = new LocalYamlRegistryRepository({ path, parseOpts: OPTS });
    await repo.refresh();
    let agents = await repo.agents.listByTenantId(TENANT_ID);
    expect(agents[0]?.agentSlug).toBe('greeter');

    await source.write(minimalYaml({ agentSlug: 'farewell' }));
    await repo.refresh();
    agents = await repo.agents.listByTenantId(TENANT_ID);
    expect(agents[0]?.agentSlug).toBe('farewell');
  });

  it('rawText.write rejects invalid YAML and does not touch the file', async () => {
    const source = new LocalYamlSource({ path });
    await source.write(minimalYaml());

    const repo = new LocalYamlRegistryRepository({ path, parseOpts: OPTS });
    await repo.refresh();

    const before = await readFile(path, 'utf-8');
    await expect(repo.rawText.write('this is: not: valid: registry')).rejects.toThrow();
    const after = await readFile(path, 'utf-8');
    expect(after).toBe(before);
  });

  it('rawText.write persists valid text and re-indexes', async () => {
    const source = new LocalYamlSource({ path });
    await source.write(minimalYaml({ agentSlug: 'first' }));

    const repo = new LocalYamlRegistryRepository({ path, parseOpts: OPTS });
    await repo.refresh();

    await repo.rawText.write(minimalYaml({ agentSlug: 'second' }));
    const agents = await repo.agents.listByTenantId(TENANT_ID);
    expect(agents[0]?.agentSlug).toBe('second');

    const raw = await readFile(path, 'utf-8');
    expect(raw).toContain('slug: second');
  });
});
