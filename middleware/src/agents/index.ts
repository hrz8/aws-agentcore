import {
  AGENT_MODE,
  AGENT_PLAIN_URL,
  AGENT_RUNTIME_ARN,
  AGENT_RUNTIME_QUALIFIER,
  AWS_REGION,
} from '../config.js';
import type { AgentInvoker } from './invoker.js';
import { AgentCoreInvoker } from './agentcore.js';
import { PlainHttpInvoker } from './plain.js';

export type { AgentInvoker, InvokeParams } from './invoker.js';

export function createInvoker(): AgentInvoker {
  switch (AGENT_MODE) {
    case 'plain':
      return new PlainHttpInvoker(AGENT_PLAIN_URL);
    case 'agentcore':
      if (!AGENT_RUNTIME_ARN) {
        throw new Error('AGENT_RUNTIME_ARN is required when AGENT_MODE=agentcore');
      }
      return new AgentCoreInvoker({
        runtimeArn: AGENT_RUNTIME_ARN,
        region: AWS_REGION,
        qualifier: AGENT_RUNTIME_QUALIFIER,
      });
  }
}
