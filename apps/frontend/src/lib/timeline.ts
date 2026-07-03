import type { Message, ToolCall, ToolMessage } from '@ag-ui/client';

export type TimelineItem =
  | { kind: 'user'; id: string; content: string }
  | { kind: 'assistant'; id: string; messageId: string; content: string }
  | { kind: 'tool'; id: string; toolCall: ToolCall; toolMessage?: ToolMessage };

export function normalizeStoredMessage(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') {
    return raw;
  }
  const msg = raw as Record<string, unknown>;
  if (msg.role !== 'assistant' || !Array.isArray(msg.toolCalls)) {
    return msg;
  }
  return {
    ...msg,
    toolCalls: msg.toolCalls.map(tc => {
      if (!tc || typeof tc !== 'object') {
        return tc;
      }
      const obj = tc as Record<string, unknown>;
      if (obj.function && typeof obj.function === 'object') {
        return obj;
      }
      return {
        id: obj.id,
        type: 'function',
        function: {
          name: typeof obj.name === 'string' ? obj.name : '',
          arguments: typeof obj.args === 'string' ? obj.args : '',
        },
      };
    }),
  };
}

export function projectTimeline(messages: Message[]): TimelineItem[] {
  const toolMessages = new Map<string, ToolMessage>();
  for (const msg of messages) {
    if (msg.role === 'tool') {
      toolMessages.set(msg.toolCallId, msg);
    }
  }

  const items: TimelineItem[] = [];
  for (const msg of messages) {
    if (msg.role === 'user') {
      items.push({ kind: 'user', id: msg.id, content: contentToString(msg.content) });
    } else if (msg.role === 'assistant') {
      const text = contentToString(msg.content);
      if (text.length > 0) {
        items.push({
          kind: 'assistant',
          id: `${msg.id}-text`,
          messageId: msg.id,
          content: text,
        });
      }
      for (const tc of msg.toolCalls ?? []) {
        items.push({
          kind: 'tool',
          id: tc.id,
          toolCall: tc,
          toolMessage: toolMessages.get(tc.id),
        });
      }
    }
  }
  return items;
}

function contentToString(content: Message['content']): string {
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return '';
  }
  let out = '';
  for (const part of content) {
    if (part.type === 'text') out += part.text;
  }
  return out;
}
