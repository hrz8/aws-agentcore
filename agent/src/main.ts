import { BedrockAgentCoreApp } from 'bedrock-agentcore/runtime';
import { z } from 'zod';

import { createSimpleAgent } from './agents/simple.js';
import { PORT } from './config.js';
import { shutdown } from './shutdown.js';

const ChatRequestSchema = z.object({
  prompt: z.string().min(1, 'prompt is required'),
});

const agent = createSimpleAgent();

const app = new BedrockAgentCoreApp({
  invocationHandler: {
    requestSchema: ChatRequestSchema,
    async *process(request, context) {
      context.log.info({ sessionId: context.sessionId }, 'invoking simple agent');

      for await (const event of agent.stream(request.prompt)) {
        // Forward only token deltas to the client. The agent wraps raw model
        // events in modelStreamUpdateEvent; tool/usage/agentResult events are
        // dropped here — add a case if/when the client needs them.
        if (event.type !== 'modelStreamUpdateEvent') continue;
        const inner = event.event;
        if (
          inner.type === 'modelContentBlockDeltaEvent'
          && inner.delta.type === 'textDelta'
        ) {
          yield { event: 'message', data: { text: inner.delta.text } };
        }
      }
    },
  },
});

app.run({ port: PORT });

const fastify = (app as unknown as { _app: { close(): Promise<void> } })._app;
shutdown('agent', () => fastify.close());
