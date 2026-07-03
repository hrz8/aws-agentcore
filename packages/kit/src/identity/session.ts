// AgentCore runtime session id must be 33–128 chars; keep threadId at the
// tail so a trailing slice preserves per-conversation microVM affinity.
const RUNTIME_SESSION_ID_MAX = 128;
const RUNTIME_SESSION_ID_MIN = 33;
const RAW_ACTOR_MAX = 64;

export type RuntimeSessionInput = {
  tenantId: string;
  agentId: string;
  agentVersion: string | null;
  rawActor: string | undefined;
  threadId: string;
};

export function sanitizeActor(rawActor: string | undefined): string {
  const raw = rawActor && rawActor.length > 0 ? rawActor : 'guest';
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, RAW_ACTOR_MAX);
}

// Memory actorId is tenant-wide by design: agents under the same tenant
// share LTM about a user, so agent id is NOT in this key.
export function composeActorId(tenantId: string, rawActor: string | undefined): string {
  return `${tenantId}__${sanitizeActor(rawActor)}`;
}

export function composeRuntimeSessionId(input: RuntimeSessionInput): string {
  const version = input.agentVersion ?? '_';
  const composed = `${input.tenantId}__${input.agentId}__${version}__${sanitizeActor(input.rawActor)}__${input.threadId}`;
  if (composed.length > RUNTIME_SESSION_ID_MAX) {
    return composed.slice(-RUNTIME_SESSION_ID_MAX);
  }
  if (composed.length < RUNTIME_SESSION_ID_MIN) {
    return composed.padStart(RUNTIME_SESSION_ID_MIN, '_');
  }
  return composed;
}
