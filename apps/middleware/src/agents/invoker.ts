export interface InvokeParams {
  body: unknown;
  sessionId: string;
  signal?: AbortSignal;
}

export interface AgentInvoker {
  invoke(params: InvokeParams): Promise<Response>;
}
