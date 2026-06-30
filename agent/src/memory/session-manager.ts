import type { LocalAgent, MemoryManager, SnapshotStorage } from '@strands-agents/sdk';

import { AfterInvocationEvent, SessionManager } from '@strands-agents/sdk';

export class MemorySessionManager extends SessionManager {
  private readonly _memoryManager: MemoryManager;

  constructor(opts: {
    sessionId: string;
    memoryManager: MemoryManager;
    snapshot: SnapshotStorage;
  }) {
    super({
      sessionId: opts.sessionId,
      storage: { snapshot: opts.snapshot },
      saveLatestOn: 'invocation',
    });
    this._memoryManager = opts.memoryManager;
  }

  initAgent(agent: LocalAgent): void {
    super.initAgent(agent);
    this._memoryManager.initAgent(agent);
    agent.addHook(AfterInvocationEvent, async () => {
      await this._memoryManager.flush();
    });
  }

  get memoryManager(): MemoryManager {
    return this._memoryManager;
  }
}
