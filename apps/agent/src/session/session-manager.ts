import type { LocalAgent, MemoryManager, SnapshotStorage } from '@strands-agents/sdk';
import type { AgentSkills } from '@strands-agents/sdk/vended-plugins/skills';

import {
  AfterInvocationEvent,
  BeforeInvocationEvent,
  HookOrder,
  SessionManager,
} from '@strands-agents/sdk';

export class AgentSessionManager extends SessionManager {
  private readonly _memoryManager: MemoryManager;
  private readonly _beforeInvocation?: () => Promise<void>;
  private readonly _skillsPlugin?: AgentSkills;

  constructor(opts: {
    sessionId: string;
    memoryManager: MemoryManager;
    snapshot: SnapshotStorage;
    beforeInvocation?: () => Promise<void>;
    skillsPlugin?: AgentSkills;
  }) {
    super({
      sessionId: opts.sessionId,
      storage: { snapshot: opts.snapshot },
      saveLatestOn: 'invocation',
    });
    this._memoryManager = opts.memoryManager;
    this._beforeInvocation = opts.beforeInvocation;
    this._skillsPlugin = opts.skillsPlugin;
  }

  initAgent(agent: LocalAgent): void {
    super.initAgent(agent);
    if (this._skillsPlugin) {
      void this._skillsPlugin.initAgent(agent).catch(err => {
        console.warn(
          `[agent] skills plugin per-clone init failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }
    this._memoryManager.initAgent(agent);
    if (this._beforeInvocation) {
      const cb = this._beforeInvocation;
      agent.addHook(BeforeInvocationEvent, async () => {
        await cb();
      }, { order: HookOrder.SDK_FIRST });
    }
    agent.addHook(AfterInvocationEvent, async () => {
      await this._memoryManager.flush();
    });
  }

  get memoryManager(): MemoryManager {
    return this._memoryManager;
  }
}
