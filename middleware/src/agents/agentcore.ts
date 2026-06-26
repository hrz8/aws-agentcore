import { Sha256 } from '@aws-crypto/sha256-js';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { HttpRequest } from '@smithy/protocol-http';
import { SignatureV4 } from '@smithy/signature-v4';

import type { AgentInvoker, InvokeParams } from './invoker.js';

export type AgentCoreInvokerOptions = {
  readonly runtimeArn: string;
  readonly region: string;
  readonly qualifier?: string;
};

const SESSION_ID_MIN = 33;
const SESSION_ID_MAX = 128;

export class AgentCoreInvoker implements AgentInvoker {
  private readonly signer: SignatureV4;
  private readonly host: string;
  private readonly path: string;
  private readonly qualifier: string | undefined;

  constructor({ runtimeArn, region, qualifier }: AgentCoreInvokerOptions) {
    this.signer = new SignatureV4({
      service: 'bedrock-agentcore',
      region,
      sha256: Sha256,
      credentials: fromNodeProviderChain(),
    });
    this.host = `bedrock-agentcore.${region}.amazonaws.com`;
    this.path = `/runtimes/${encodeURIComponent(runtimeArn)}/invocations`;
    this.qualifier = qualifier;
  }

  async invoke({ body, sessionId, signal }: InvokeParams): Promise<Response> {
    if (sessionId.length < SESSION_ID_MIN || sessionId.length > SESSION_ID_MAX) {
      throw new Error(
        `sessionId must be ${SESSION_ID_MIN}-${SESSION_ID_MAX} chars (got ${sessionId.length}). `
        + 'AgentCore Runtime rejects shorter values.',
      );
    }

    const payload = JSON.stringify(body);
    const query = this.qualifier ? { qualifier: this.qualifier } : undefined;

    const request = new HttpRequest({
      method: 'POST',
      protocol: 'https:',
      hostname: this.host,
      path: this.path,
      ...(query ? { query } : {}),
      headers: {
        'host': this.host,
        'content-type': 'application/json',
        'accept': 'text/event-stream',
        'x-amzn-bedrock-agentcore-runtime-session-id': sessionId,
      },
      body: payload,
    });

    const signed = await this.signer.sign(request);

    const url = `https://${this.host}${this.path}${this.qualifier ? `?qualifier=${encodeURIComponent(this.qualifier)}` : ''}`;

    return fetch(url, {
      method: 'POST',
      headers: signed.headers as Record<string, string>,
      body: payload,
      signal,
    });
  }
}
