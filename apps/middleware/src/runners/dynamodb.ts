import type { AbstractAgent, BaseEvent, Message, MessagesSnapshotEvent, RunAgentInput, RunStartedEvent } from '@ag-ui/client';
import type {
  AgentRunnerConnectRequest,
  AgentRunnerIsRunningRequest,
  AgentRunnerRunRequest,
  AgentRunnerStopRequest,
} from '@copilotkit/runtime/v2';
import type { DynamoDBDocumentClient } from '@repo/kit/aws/dynamodb';
import type { Observable } from 'rxjs';
import { compactEvents, EventType } from '@ag-ui/client';
import { AgentRunner, finalizeRunEvents } from '@copilotkit/runtime/v2';
import { createDynamoDbClient, PutCommand, QueryCommand } from '@repo/kit/aws/dynamodb';
import { ReplaySubject } from 'rxjs';

type ActiveConnection = {
  subject: ReplaySubject<BaseEvent>;
  agent?: AbstractAgent;
  runSubject?: ReplaySubject<BaseEvent>;
  currentEvents?: BaseEvent[];
  stopRequested?: boolean;
};

const ACTIVE_CONNECTIONS = new Map<string, ActiveConnection>();

export type DynamoDbRunnerOptions = {
  tableName: string;
  region?: string;
  ttlSeconds: number;
};

export class DynamoDbRunner extends AgentRunner {
  private client: DynamoDBDocumentClient;
  private tableName: string;
  private ttlSeconds: number;

  constructor(options: DynamoDbRunnerOptions) {
    super();
    this.tableName = options.tableName;
    this.ttlSeconds = options.ttlSeconds;
    this.client = createDynamoDbClient({ region: options.region });
  }

  private ttl(): number {
    return Math.floor(Date.now() / 1000) + this.ttlSeconds;
  }

  private async storeRun(
    threadKey: string,
    runId: string,
    events: BaseEvent[],
    input: RunAgentInput,
    parentRunId?: string | null,
  ): Promise<void> {
    const compacted = compactEvents(events);
    const now = Date.now();
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        threadKey,
        SK: `RUN#${now}-${runId}`,
        runId,
        parentRunId: parentRunId ?? null,
        events: JSON.stringify(compacted),
        input: JSON.stringify(input),
        createdAt: now,
        expiresAt: this.ttl(),
      },
    }));
  }

  private async getHistoricRuns(
    threadKey: string,
  ): Promise<Array<{ runId: string; events: BaseEvent[]; createdAt: number }>> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'threadKey = :tk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':tk': threadKey,
        ':prefix': 'RUN#',
      },
    }));

    return (result.Items ?? [])
      .map((item) => ({
        runId: item.runId as string,
        events: JSON.parse(item.events as string) as BaseEvent[],
        createdAt: item.createdAt as number,
      }))
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  private async getLatestRunId(threadKey: string): Promise<string | null> {
    const runs = await this.getHistoricRuns(threadKey);
    return runs.length > 0 ? runs.at(-1)!.runId : null;
  }

  private async setRunState(threadKey: string, isRunning: boolean, runId?: string): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        threadKey,
        SK: 'STATE',
        isRunning,
        currentRunId: runId ?? null,
        updatedAt: Date.now(),
        expiresAt: this.ttl(),
      },
    }));
  }

  private async getRunState(threadKey: string): Promise<{ isRunning: boolean; currentRunId: string | null }> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'threadKey = :tk AND SK = :sk',
      ExpressionAttributeValues: {
        ':tk': threadKey,
        ':sk': 'STATE',
      },
    }));

    const item = result.Items?.[0];
    return {
      isRunning: item?.isRunning === true,
      currentRunId: (item?.currentRunId as string) ?? null,
    };
  }

  private async collectHistoricMessageIds(threadKey: string): Promise<Set<string>> {
    const ids = new Set<string>();
    for (const run of await this.getHistoricRuns(threadKey)) {
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
    const { threadId: threadKey, agent, input } = request;

    const runSubject = new ReplaySubject<BaseEvent>(Infinity);
    const nextSubject = new ReplaySubject<BaseEvent>(Infinity);
    const currentRunEvents: BaseEvent[] = [];

    const emit = (event: BaseEvent) => {
      runSubject.next(event);
      nextSubject.next(event);
      currentRunEvents.push(event);
    };

    const runAgent = async () => {
      const runState = await this.getRunState(threadKey);
      if (runState.isRunning) {
        throw new Error('Thread already running');
      }

      await this.setRunState(threadKey, true, input.runId);

      const historicMessageIds = await this.collectHistoricMessageIds(threadKey);
      const parentRunId = await this.getLatestRunId(threadKey);

      const prevConnection = ACTIVE_CONNECTIONS.get(threadKey);
      ACTIVE_CONNECTIONS.set(threadKey, {
        subject: nextSubject,
        agent,
        runSubject,
        currentEvents: currentRunEvents,
        stopRequested: false,
      });

      if (prevConnection?.subject) {
        prevConnection.subject.subscribe({ next: (e) => nextSubject.next(e) });
      }

      const doFinalize = async (stopRequested: boolean) => {
        const appended = finalizeRunEvents(currentRunEvents, { stopRequested });
        for (const e of appended) {
          runSubject.next(e);
          nextSubject.next(e);
        }

        if (currentRunEvents.length > 0) {
          await this.storeRun(threadKey, input.runId, currentRunEvents, input, parentRunId);
        }

        await this.setRunState(threadKey, false);
        ACTIVE_CONNECTIONS.delete(threadKey);
        runSubject.complete();
        nextSubject.complete();
      };

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
        await doFinalize(ACTIVE_CONNECTIONS.get(threadKey)?.stopRequested ?? false);
      } catch {
        await doFinalize(ACTIVE_CONNECTIONS.get(threadKey)?.stopRequested ?? false);
      }
    };

    runAgent();
    return runSubject.asObservable();
  }

  connect(request: AgentRunnerConnectRequest): Observable<BaseEvent> {
    const connectionSubject = new ReplaySubject<BaseEvent>(Infinity);

    const loadAndEmit = async () => {
      const allEvents: BaseEvent[] = [];
      for (const run of await this.getHistoricRuns(request.threadId)) {
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
      if (active && active.stopRequested !== undefined) {
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
    };

    loadAndEmit();
    return connectionSubject.asObservable();
  }

  async getThreadMessagesAsync(threadId: string): Promise<Message[]> {
    const runs = await this.getHistoricRuns(threadId);
    if (runs.length === 0) return [];
    const allEvents: BaseEvent[] = [];
    for (const run of runs) allEvents.push(...run.events);
    const compacted = compactEvents(allEvents);
    for (let i = compacted.length - 1; i >= 0; i--) {
      const e = compacted[i];
      if (e?.type === EventType.MESSAGES_SNAPSHOT) {
        return (e as MessagesSnapshotEvent).messages ?? [];
      }
    }
    return [];
  }

  async isRunning(request: AgentRunnerIsRunningRequest): Promise<boolean> {
    const { isRunning } = await this.getRunState(request.threadId);
    return isRunning;
  }

  async stop(request: AgentRunnerStopRequest): Promise<boolean | undefined> {
    const connection = ACTIVE_CONNECTIONS.get(request.threadId);
    if (!connection?.agent || connection.stopRequested) {
      return false;
    }

    connection.stopRequested = true;
    await this.setRunState(request.threadId, false);

    try {
      connection.agent.abortRun();
      return true;
    } catch {
      connection.stopRequested = false;
      return false;
    }
  }
}
