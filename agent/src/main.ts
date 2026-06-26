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
        // Forward three event categories to the client:
        //   - textDelta chunks    → event: message
        //   - tool invocations    → event: tool_call
        //   - tool results        → event: tool_result
        // All other lifecycle events are dropped.
        switch (event.type) {
          case 'modelStreamUpdateEvent': {
            const inner = event.event;
            if (
              inner.type === 'modelContentBlockDeltaEvent'
              && inner.delta.type === 'textDelta'
            ) {
              yield { event: 'message', data: { text: inner.delta.text } };
            }
            break;
          }
          case 'beforeToolCallEvent':
            yield {
              event: 'tool_call',
              data: {
                name: event.toolUse.name,
                toolUseId: event.toolUse.toolUseId,
                input: event.toolUse.input,
              },
            };
            break;
          case 'toolResultEvent':
            yield {
              event: 'tool_result',
              data: {
                toolUseId: event.result.toolUseId,
                status: event.result.status,
                content: event.result.content,
              },
            };
            break;
        }
      }
    },
  },
});

app.run({ port: PORT });

const fastify = (app as unknown as { _app: { close(): Promise<void> } })._app;
shutdown('agent', () => fastify.close());
