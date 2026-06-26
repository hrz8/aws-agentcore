export const PORT = Number.parseInt(process.env.PORT ?? '8080', 10);

export type AgentMode = 'plain' | 'agentcore';

function parseAgentMode(value: string | undefined): AgentMode {
  if (value === 'plain' || value === 'agentcore') return value;
  return 'plain';
}

export const AGENT_MODE: AgentMode = parseAgentMode(process.env.AGENT_MODE);
export const AGENT_PLAIN_URL = process.env.AGENT_PLAIN_URL ?? 'http://localhost:5678';

// AGENT_MODE=agentcore — SigV4-signed call to a deployed AgentCore Runtime.
export const AGENT_RUNTIME_ARN = process.env.AGENT_RUNTIME_ARN;
export const AWS_REGION = process.env.AWS_REGION ?? 'us-east-1';
// Optional endpoint qualifier; defaults to 'DEFAULT' which routes to the runtime's default endpoint.
export const AGENT_RUNTIME_QUALIFIER = process.env.AGENT_RUNTIME_QUALIFIER;
