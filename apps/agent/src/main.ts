import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { StrandsAgent } from '@ag-ui/aws-strands';
import { addPing, addStrandsExpressEndpoint } from '@ag-ui/aws-strands/server';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';

import type { AgentDefinition, RegistryRepository } from '@repo/registry';

import { buildAgent, type BuiltAgent } from './agents/factory.js';
import { createRegistryRepository } from './agents/registry-factory.js';
import { composeAgentScope, isUuid, type Scope } from '@repo/kit/identity';

import {
  KB_ID,
  KB_WEB_DATA_SOURCE_ID,
  MEMORY_ID,
  MEMORY_PROVIDER,
  MemoryProvider,
  PORT,
  REGISTRY_SOURCE,
  UPLOADS_BUCKET,
} from './config.js';
import { createMemoryManager } from './memory/factory.js';
import { createMemorySnapshotStorage } from './memory/snapshot-storage.js';
import { AgentSessionManager } from './session/session-manager.js';
import { shutdown } from './shutdown.js';

const BOOT_ID = randomUUID();
const BOOT_AT_ISO = new Date().toISOString();
console.info(`[agent] boot id=${BOOT_ID} at=${BOOT_AT_ISO} pid=${process.pid}`);

const registry: RegistryRepository = await createRegistryRepository();
const MEMORY_SNAPSHOT_STORAGE = createMemorySnapshotStorage();

console.info(`[agent] registry source: ${REGISTRY_SOURCE}`);
console.info(`[agent] stage kb=${KB_ID ?? 'off'} web=${KB_WEB_DATA_SOURCE_ID ?? 'off'} bucket=${UPLOADS_BUCKET ?? 'off'} memory=${MEMORY_ID ? 'on' : 'off'}`);

const MAX_CACHED_SUB_APPS = 10;
const subAppByScope = new Map<string, express.Express>();
const buildInFlight = new Map<string, Promise<express.Express | null>>();

function touchSubAppLru(key: string, value: express.Express): void {
  subAppByScope.delete(key);
  subAppByScope.set(key, value);
  while (subAppByScope.size > MAX_CACHED_SUB_APPS) {
    const oldest = subAppByScope.keys().next().value;
    if (oldest === undefined) break;
    subAppByScope.delete(oldest);
    console.info(`[agent] evicted sub-app from cache (LRU): ${oldest}`);
  }
}

async function getOrBuildSubApp(scope: Scope): Promise<express.Express | null> {
  const key = composeAgentScope(scope.tenantId, scope.agentId, scope.version);
  const cached = subAppByScope.get(key);
  if (cached) {
    touchSubAppLru(key, cached);
    return cached;
  }

  const existing = buildInFlight.get(key);
  if (existing) {
    return existing;
  }

  const p = (async (): Promise<express.Express | null> => {
    const def = await registry.agents.getByIds(scope.tenantId, scope.agentId, scope.version);
    if (!def) {
      return null;
    }

    console.info(`[agent] building ${key} on first use`);
    const built = await buildAgent({ def, registry });
    const subApp = await makeSubApp(def, built);
    touchSubAppLru(key, subApp);
    return subApp;
  })().finally(() => {
    buildInFlight.delete(key);
  });

  buildInFlight.set(key, p);
  return p;
}

async function makeSubApp(def: AgentDefinition, built: BuiltAgent): Promise<express.Express> {
  const aguiAgent = new StrandsAgent({
    agent: built.agent,
    name: `${def.tenantSlug}__${def.agentSlug}__${def.version}`,
    description: def.description,
    config: {
      sessionManagerProvider: async (input) => {
        console.info(
          `[agent] session-start thread=${input.threadId} scope=${def.tenantId}/${def.agentId}/${def.version} `
          + `boot=${BOOT_ID} bootAt=${BOOT_AT_ISO}`,
        );
        const fp = (input.forwardedProps ?? {}) as Record<string, unknown>;
        const actorId = typeof fp.actorId === 'string' ? fp.actorId : '';
        if (actorId.length === 0) {
          console.warn(`[agent] actorId missing on forwardedProps; memory not wired for thread ${input.threadId}`);
          return undefined;
        }
        if (MEMORY_PROVIDER === MemoryProvider.None || !MEMORY_ID) {
          return undefined;
        }
        const memoryManager = createMemoryManager({ actorId, sessionId: input.threadId });
        if (!memoryManager) return undefined;

        return new AgentSessionManager({
          sessionId: input.threadId,
          memoryManager,
          snapshot: MEMORY_SNAPSHOT_STORAGE,
          beforeInvocation: built.refreshSkillsIfStale,
          skillsPlugin: built.skillsPlugin,
        });
      },
    },
  });

  const subApp = express();
  addStrandsExpressEndpoint(subApp, aguiAgent, { path: '/invocations' });
  return subApp;
}

type ExtractedScope =
  | { ok: true; scope: Scope; versionExplicit: boolean }
  | { ok: false; status: number; error: string };

async function extractScope(body: unknown): Promise<ExtractedScope> {
  if (!body || typeof body !== 'object') {
    return {
      ok: false,
      status: 400,
      error: 'body must be an object',
    };
  }
  const fp = (body as { forwardedProps?: unknown }).forwardedProps;
  if (!fp || typeof fp !== 'object') {
    return {
      ok: false,
      status: 400,
      error: 'forwardedProps missing on body',
    };
  }
  const tenantId = (fp as Record<string, unknown>).tenantId;
  const agentId = (fp as Record<string, unknown>).agentId;
  const agentVersion = (fp as Record<string, unknown>).agentVersion;

  if (typeof tenantId !== 'string' || !isUuid(tenantId)) {
    return {
      ok: false,
      status: 400,
      error: 'forwardedProps.tenantId must be a UUID',
    };
  }
  if (typeof agentId !== 'string' || !isUuid(agentId)) {
    return {
      ok: false,
      status: 400,
      error: 'forwardedProps.agentId must be a UUID',
    };
  }

  if (agentVersion !== undefined && agentVersion !== null && agentVersion !== '' && typeof agentVersion !== 'string') {
    return {
      ok: false,
      status: 400,
      error: 'forwardedProps.agentVersion must be a string when present',
    };
  }

  const explicit = typeof agentVersion === 'string' && agentVersion.length > 0;
  let version: string;
  if (explicit) {
    version = agentVersion as string;
  } else {
    try {
      await registry.refresh();
      const resolved = await registry.agents.resolveEnabledByIds(tenantId, agentId);
      version = resolved.version;
    } catch (err) {
      return {
        ok: false,
        status: 404,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return {
    ok: true,
    scope: {
      tenantId,
      agentId,
      version,
    },
    versionExplicit: explicit,
  };
}

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
addPing(app, '/ping');

app.post('/invocations', async (req: Request, res: Response, next: NextFunction) => {
  const extracted = await extractScope(req.body);
  if (!extracted.ok) {
    res.status(extracted.status).json({ error: extracted.error });
    return;
  }

  let subApp: express.Express | null;
  try {
    subApp = await getOrBuildSubApp(extracted.scope);
  } catch (err) {
    res.status(500).json({
      error: 'failed to build agent',
      detail: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  if (!subApp) {
    res.status(404).json({
      error: `unknown agent: ${extracted.scope.tenantId}/${extracted.scope.agentId}/${extracted.scope.version}`,
    });
    return;
  }

  subApp(req, res, next);
});

const server = app.listen(PORT, () => {
  console.info(`[agent] listening on http://localhost:${PORT}`);
  console.info(`[agent] memory provider: ${MEMORY_PROVIDER}`);
});

shutdown('agent', () => promisify(server.close).call(server));
