import { AGENT_MODE, AGENT_PLAIN_URL } from '../config.js';
import type { AgentInvoker } from './invoker.js';
import { PlainHttpInvoker } from './plain.js';

export type { AgentInvoker, InvokeParams } from './invoker.js';

export function createInvoker(): AgentInvoker {
  switch (AGENT_MODE) {
    case 'plain':
      return new PlainHttpInvoker(AGENT_PLAIN_URL);
    case 'agentcore':
      throw new Error('AGENT_MODE=agentcore is not implemented yet');
  }
}
