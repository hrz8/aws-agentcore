/**
 * AgentInvoker is the seam between the middleware and whatever runs the agent.
 */
export interface InvokeParams {
  /** Parsed JSON body forwarded to the agent verbatim. */
  body: unknown;
  /** Tenant scope — forwarded as `x-tenant-id`. */
  tenantId: string;
  /** Agent selector — forwarded as `x-agent-id`. */
  agentId: string;
  /** AgentCore runtime session id — required header upstream. */
  sessionId: string;
  /** Propagated from the inbound request so client disconnects cancel upstream. */
  signal?: AbortSignal;
}

export interface AgentInvoker {
  invoke(params: InvokeParams): Promise<Response>;
}
