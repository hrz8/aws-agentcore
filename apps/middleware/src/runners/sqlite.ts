import type { AbstractAgent, BaseEvent, Message, MessagesSnapshotEvent, RunAgentInput, RunStartedEvent } from '@ag-ui/client';
import type {
  AgentRunnerConnectRequest,
  AgentRunnerIsRunningRequest,
  AgentRunnerRunRequest,
  AgentRunnerStopRequest,
  LocalThreadEndpointRecord,
} from '@copilotkit/runtime/v2';
import type { Observable } from 'rxjs';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { compactEvents, EventType } from '@ag-ui/client';
import { AgentRunner, finalizeRunEvents } from '@copilotkit/runtime/v2';
import Database from 'better-sqlite3';
import { ReplaySubject } from 'rxjs';

type ActiveConnection = {
  subject: ReplaySubject<BaseEvent>;
  agent?: AbstractAgent;
  runSubject?: ReplaySubject<BaseEvent>;
  currentEvents?: BaseEvent[];
  stopRequested?: boolean;
};

const ACTIVE_CONNECTIONS = new Map<string, ActiveConnection>();

export type SqliteRunnerOptions = {
  dbPath?: string;
};

export class SqliteRunner extends AgentRunner {
  readonly ɵsupportsLocalThreadEndpoints = true as const;
  private db: InstanceType<typeof Database>;

  constructor(options: SqliteRunnerOptions = {}) {
    super();
    const path = options.dbPath ?? '.data/threads.db';
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id TEXT NOT NULL,
        run_id TEXT NOT NULL UNIQUE,
        parent_run_id TEXT,
        events TEXT NOT NULL,
        input TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS run_state (
        thread_id TEXT PRIMARY KEY,
        is_running INTEGER DEFAULT 0,
        current_run_id TEXT,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_thread_id ON agent_runs(thread_id);
    `);
  }

  private storeRun(threadId: string, runId: string, events: BaseEvent[], input: RunAgentInput, parentRunId?: string | null): void {
    const compacted = compactEvents(events);
    this.db.prepare(`
      INSERT INTO agent_runs (thread_id, run_id, parent_run_id, events, input, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(threadId, runId, parentRunId ?? null, JSON.stringify(compacted), JSON.stringify(input), Date.now());
  }

  private getHistoricRuns(threadId: string): Array<{ run_id: string; events: BaseEvent[] }> {
    const rows = this.db.prepare(`
      WITH RECURSIVE run_chain AS (
        SELECT * FROM agent_runs WHERE thread_id = ? AND parent_run_id IS NULL
        UNION ALL
        SELECT ar.* FROM agent_runs ar
        INNER JOIN run_chain rc ON ar.parent_run_id = rc.run_id
        WHERE ar.thread_id = ?
      )
      SELECT * FROM run_chain ORDER BY created_at ASC
    `).all(threadId, threadId) as Array<{ run_id: string; events: string }>;

    return rows.map((r) => ({ run_id: r.run_id, events: JSON.parse(r.events) }));
  }

  private getLatestRunId(threadId: string): string | null {
    const row = this.db.prepare(`
      SELECT run_id FROM agent_runs WHERE thread_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(threadId) as { run_id: string } | undefined;
    return row?.run_id ?? null;
  }

  private setRunState(threadId: string, isRunning: boolean, runId?: string): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO run_state (thread_id, is_running, current_run_id, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(threadId, isRunning ? 1 : 0, runId ?? null, Date.now());
  }

  private getRunState(threadId: string): { isRunning: boolean; currentRunId: string | null } {
    const row = this.db.prepare(`
      SELECT is_running, current_run_id FROM run_state WHERE thread_id = ?
    `).get(threadId) as { is_running: number; current_run_id: string | null } | undefined;
    return { isRunning: row?.is_running === 1, currentRunId: row?.current_run_id ?? null };
  }

  private collectHistoricMessageIds(threadId: string): Set<string> {
    const ids = new Set<string>();
    for (const run of this.getHistoricRuns(threadId)) {
      for (const event of run.events) {
        if ('messageId' in event && typeof event.messageId === 'string') {
          ids.add(event.messageId);
        }
        if (event.type === EventType.RUN_STARTED) {
          for (const msg of (event as RunStartedEvent).input?.messages ?? []) {
            ids.add(msg.id);
          }
        }
      }
    }
    return ids;
  }

  run(request: AgentRunnerRunRequest): Observable<BaseEvent> {
    const { threadId, agent, input } = request;

    if (this.getRunState(threadId).isRunning) {
      throw new Error('Thread already running');
    }

    this.setRunState(threadId, true, input.runId);

    const currentRunEvents: BaseEvent[] = [];
    const historicMessageIds = this.collectHistoricMessageIds(threadId);
    const parentRunId = this.getLatestRunId(threadId);

    const nextSubject = new ReplaySubject<BaseEvent>(Infinity);
    const runSubject = new ReplaySubject<BaseEvent>(Infinity);
    const prevConnection = ACTIVE_CONNECTIONS.get(threadId);

    ACTIVE_CONNECTIONS.set(threadId, {
      subject: nextSubject,
      agent,
      runSubject,
      currentEvents: currentRunEvents,
      stopRequested: false,
    });

    const emit = (event: BaseEvent) => {
      runSubject.next(event);
      nextSubject.next(event);
      currentRunEvents.push(event);
    };

    const finalize = (stopRequested: boolean) => {
      const appended = finalizeRunEvents(currentRunEvents, { stopRequested });
      for (const e of appended) {
        runSubject.next(e);
        nextSubject.next(e);
      }

      if (currentRunEvents.length > 0) {
        this.storeRun(threadId, input.runId, currentRunEvents, input, parentRunId);
      }

      this.setRunState(threadId, false);
      ACTIVE_CONNECTIONS.delete(threadId);
      runSubject.complete();
      nextSubject.complete();
    };

    const runAgent = async () => {
      try {
        await agent.runAgent(input, {
          onEvent: ({ event }: { event: BaseEvent }) => {
            let processed = event;
            if (event.type === EventType.RUN_STARTED && !(event as RunStartedEvent).input) {
              const sanitized = input.messages?.filter((m) => !historicMessageIds.has(m.id));
              processed = { ...event, input: { ...input, ...(sanitized ? { messages: sanitized } : {}) } } as BaseEvent;
            }
            emit(processed);
          },
          onRunStartedEvent: () => {
            for (const msg of input.messages ?? []) {
              historicMessageIds.add(msg.id);
            }
          },
        });
        finalize(ACTIVE_CONNECTIONS.get(threadId)?.stopRequested ?? false);
      } catch {
        finalize(ACTIVE_CONNECTIONS.get(threadId)?.stopRequested ?? false);
      }
    };

    if (prevConnection?.subject) {
      prevConnection.subject.subscribe({ next: (e) => nextSubject.next(e) });
    }

    runAgent();
    return runSubject.asObservable();
  }

  connect(request: AgentRunnerConnectRequest): Observable<BaseEvent> {
    const connectionSubject = new ReplaySubject<BaseEvent>(Infinity);

    const allEvents: BaseEvent[] = [];
    for (const run of this.getHistoricRuns(request.threadId)) {
      allEvents.push(...run.events);
    }

    const compacted = compactEvents(allEvents);
    const emittedIds = new Set<string>();

    for (const event of compacted) {
      connectionSubject.next(event);
      if ('messageId' in event && typeof event.messageId === 'string') {
        emittedIds.add(event.messageId);
      }
    }

    const active = ACTIVE_CONNECTIONS.get(request.threadId);
    const runState = this.getRunState(request.threadId);

    if (active && (runState.isRunning || active.stopRequested)) {
      active.subject.subscribe({
        next: (event) => {
          if ('messageId' in event && typeof event.messageId === 'string' && emittedIds.has(event.messageId)) {
            return;
          }
          connectionSubject.next(event);
        },
        complete: () => connectionSubject.complete(),
        error: (err) => connectionSubject.error(err),
      });
    } else {
      connectionSubject.complete();
    }

    return connectionSubject.asObservable();
  }

  // LocalThreadEndpointRunner: CopilotKit multi-route dispatches to these directly.
  getThreadMessages(threadId: string): Message[] {
    const events = this.compactedEvents(threadId);
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e?.type === EventType.MESSAGES_SNAPSHOT) {
        return (e as MessagesSnapshotEvent).messages ?? [];
      }
    }
    return [];
  }

  getThreadEvents(threadId: string): BaseEvent[] {
    return this.compactedEvents(threadId);
  }

  getThreadState(threadId: string): Record<string, unknown> | null {
    const events = this.compactedEvents(threadId);
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e?.type === EventType.STATE_SNAPSHOT) {
        const snapshot = (e as { snapshot?: unknown }).snapshot;
        return snapshot && typeof snapshot === 'object' ? (snapshot as Record<string, unknown>) : null;
      }
    }
    return null;
  }

  listThreads(): LocalThreadEndpointRecord[] {
    const rows = this.db.prepare(`
      SELECT thread_id, MIN(created_at) AS first, MAX(created_at) AS last
      FROM agent_runs GROUP BY thread_id ORDER BY last DESC
    `).all() as Array<{ thread_id: string; first: number; last: number }>;
    return rows.map((r) => ({
      id: r.thread_id,
      name: null,
      agentId: 'default',
      organizationId: '',
      createdById: '',
      archived: false,
      createdAt: new Date(r.first).toISOString(),
      updatedAt: new Date(r.last).toISOString(),
    }));
  }

  clearThreads(): void {
    this.db.exec('DELETE FROM agent_runs; DELETE FROM run_state;');
  }

  private compactedEvents(threadId: string): BaseEvent[] {
    const all: BaseEvent[] = [];
    for (const run of this.getHistoricRuns(threadId)) all.push(...run.events);
    return compactEvents(all);
  }

  isRunning(request: AgentRunnerIsRunningRequest): Promise<boolean> {
    return Promise.resolve(this.getRunState(request.threadId).isRunning);
  }

  stop(request: AgentRunnerStopRequest): Promise<boolean | undefined> {
    const connection = ACTIVE_CONNECTIONS.get(request.threadId);
    if (!connection?.agent || connection.stopRequested) {
      return Promise.resolve(false);
    }

    connection.stopRequested = true;
    this.setRunState(request.threadId, false);

    try {
      connection.agent.abortRun();
      return Promise.resolve(true);
    } catch {
      connection.stopRequested = false;
      this.setRunState(request.threadId, true);
      return Promise.resolve(false);
    }
  }

  close(): void {
    this.db.close();
  }
}
