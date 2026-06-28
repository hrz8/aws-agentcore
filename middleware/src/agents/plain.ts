import type { AgentInvoker, InvokeParams } from './invoker.js';

export class PlainHttpInvoker implements AgentInvoker {
  constructor(private readonly baseUrl: string) {}

  async invoke({ body, tenantId, agentId, sessionId, signal }: InvokeParams): Promise<Response> {
    return fetch(`${this.baseUrl}/invocations`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept': 'text/event-stream',
        'x-tenant-id': tenantId,
        'x-agent-id': agentId,
        'x-amzn-bedrock-agentcore-runtime-session-id': sessionId,
      },
      body: JSON.stringify(body),
      signal,
    });
  }
}
