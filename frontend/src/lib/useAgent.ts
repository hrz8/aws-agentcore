import { HttpAgent, type AgentSubscriber } from '@ag-ui/client';
import { useCallback, useRef, useState } from 'react';

export type TimelineItem =
  | { kind: 'user'; id: string; content: string }
  | { kind: 'assistant'; id: string; messageId: string; content: string }
  | {
      kind: 'tool';
      id: string;
      toolCallId: string;
      name: string;
      argsBuffer: string;
      args?: unknown;
      result?: unknown;
      status: 'calling' | 'done';
    };

export interface UseAgentResult {
  timeline: TimelineItem[];
  busy: boolean;
  error: string | null;
  send: (content: string) => Promise<void>;
  reset: () => void;
}

// Sentinel for an assistant bubble awaiting its real id from TEXT_MESSAGE_START.
const PENDING_MESSAGE_ID = '__pending__';

// AgentCore Runtime requires session id >= 33 chars; randomUUID gives 36.
function getSessionId(): string {
  const key = 'agentcore-session-id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

// Strands wraps tool results as `[{json}]` or `[{text}]`; unwrap for display.
function unwrapToolResult(content: unknown): unknown {
  if (typeof content === 'string') return content;
  if (Array.isArray(content) && content.length > 0) {
    const first = content[0] as { json?: unknown; text?: unknown };
    if (first?.json !== undefined) return first.json;
    if (first?.text !== undefined) return first.text;
  }
  return content;
}

export function useAgent(url: string): UseAgentResult {
  const agentRef = useRef<HttpAgent | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!agentRef.current) {
    agentRef.current = new HttpAgent({
      url,
      headers: {
        'X-Session-Id': getSessionId(),
      },
    });
  }

  const send = useCallback(async (content: string): Promise<void> => {
    const agent = agentRef.current;
    if (!agent || !content.trim()) return;

    setError(null);
    setBusy(true);

    const userId = crypto.randomUUID();
    agent.messages = [
      ...agent.messages,
      { id: userId, role: 'user', content },
    ];
    // Pre-reserve a pending assistant bubble so the cursor shows immediately.
    setTimeline(prev => [
      ...prev,
      { kind: 'user', id: userId, content },
      { kind: 'assistant', id: crypto.randomUUID(), messageId: PENDING_MESSAGE_ID, content: '' },
    ]);

    const subscriber: AgentSubscriber = {
      onTextMessageStartEvent: ({ event }) => {
        setTimeline(prev => {
          const lastIdx = prev.length - 1;
          const last = prev[lastIdx];
          if (last?.kind === 'assistant' && last.messageId === PENDING_MESSAGE_ID) {
            // First text segment of the turn — adopt the placeholder.
            return prev.map((item, i) =>
              i === lastIdx && item.kind === 'assistant'
                ? { ...item, messageId: event.messageId }
                : item,
            );
          }
          // Continuation after a tool — open a new bubble (split).
          return [
            ...prev,
            {
              kind: 'assistant',
              id: crypto.randomUUID(),
              messageId: event.messageId,
              content: '',
            },
          ];
        });
      },
      onTextMessageContentEvent: ({ event }) => {
        setTimeline(prev => prev.map(item =>
          item.kind === 'assistant' && item.messageId === event.messageId
            ? { ...item, content: item.content + event.delta }
            : item,
        ));
      },
      onToolCallStartEvent: ({ event }) => {
        setTimeline(prev => [
          ...prev,
          {
            kind: 'tool',
            id: crypto.randomUUID(),
            toolCallId: event.toolCallId,
            name: event.toolCallName,
            argsBuffer: '',
            status: 'calling',
          },
        ]);
      },
      onToolCallArgsEvent: ({ event }) => {
        setTimeline(prev => prev.map(item =>
          item.kind === 'tool' && item.toolCallId === event.toolCallId
            ? { ...item, argsBuffer: item.argsBuffer + event.delta }
            : item,
        ));
      },
      onToolCallEndEvent: ({ event }) => {
        setTimeline(prev => prev.map(item => {
          if (item.kind !== 'tool' || item.toolCallId !== event.toolCallId) return item;
          let args: unknown = item.argsBuffer;
          try { args = JSON.parse(item.argsBuffer); } catch { /* keep raw */ }
          return { ...item, args };
        }));
      },
      onToolCallResultEvent: ({ event }) => {
        setTimeline(prev => prev.map(item => {
          if (item.kind !== 'tool' || item.toolCallId !== event.toolCallId) return item;
          return { ...item, result: unwrapToolResult(event.content), status: 'done' };
        }));
      },
      onRunErrorEvent: ({ event }) => {
        setError(`${event.code ?? 'RUN_ERROR'}: ${event.message}`);
      },
    };

    try {
      await agent.runAgent({}, subscriber);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      // Sweep any never-adopted placeholder (tool-only turn or early error).
      setTimeline(prev => prev.filter(item =>
        !(item.kind === 'assistant'
          && item.messageId === PENDING_MESSAGE_ID
          && item.content === ''),
      ));
      setBusy(false);
    }
  }, []);

  const reset = useCallback((): void => {
    if (agentRef.current) {
      agentRef.current.messages = [];
    }
    setTimeline([]);
    setError(null);
  }, []);

  return { timeline, busy, error, send, reset };
}
