/**
 * AgentInvoker is the seam between the middleware and whatever runs the agent.
 */
export interface InvokeParams {
  /** Parsed JSON body forwarded to the agent verbatim. */
  body: unknown;
  /** AgentCore Runtime session id (≥33 chars). */
  sessionId: string;
  /** Propagated from the inbound request so client disconnects cancel upstream. */
  signal?: AbortSignal;
}

export interface AgentInvoker {
  invoke(params: InvokeParams): Promise<Response>;
}
