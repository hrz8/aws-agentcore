import type { BaseEvent } from '@ag-ui/client';
import type {
  AgentRunnerConnectRequest,
  AgentRunnerIsRunningRequest,
  AgentRunnerRunRequest,
  AgentRunnerStopRequest,
} from '@copilotkit/runtime/v2';
import type { Observable } from 'rxjs';
import { AgentRunner } from '@copilotkit/runtime/v2';

export type S3RunnerOptions = {
  bucket: string;
  prefix?: string;
  region?: string;
  ttlSeconds: number;
};

// Reserved. Implement when DDB 400KB item cap or cost becomes a problem.
export class S3Runner extends AgentRunner {
  constructor(_options: S3RunnerOptions) {
    super();
    throw new Error('S3Runner: not implemented — set RUNNER_TYPE=dynamodb');
  }

  run(_request: AgentRunnerRunRequest): Observable<BaseEvent> {
    throw new Error('S3Runner: not implemented');
  }

  connect(_request: AgentRunnerConnectRequest): Observable<BaseEvent> {
    throw new Error('S3Runner: not implemented');
  }

  isRunning(_request: AgentRunnerIsRunningRequest): Promise<boolean> {
    throw new Error('S3Runner: not implemented');
  }

  stop(_request: AgentRunnerStopRequest): Promise<boolean | undefined> {
    throw new Error('S3Runner: not implemented');
  }
}
