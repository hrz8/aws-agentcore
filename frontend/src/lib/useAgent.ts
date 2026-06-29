import type { Message } from '@ag-ui/client';
import { useAgent as useCopilotkitAgent, UseAgentUpdate } from '@copilotkit/react-core/v2';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getJson, HttpError } from './http';
import { getSessionId } from './session';
import { loadOrMintThreadId, mintThreadId } from './thread';
import { normalizeStoredMessage, projectTimeline, type TimelineItem } from './timeline';

const RUNTIME_URL = import.meta.env.VITE_AGENT_URL ?? '/copilotkit';

export interface UseAgentResult {
  timeline: TimelineItem[];
  busy: boolean;
  error: string | null;
  send: (content: string) => Promise<void>;
  reset: () => void;
}

async function fetchThreadMessages(
  threadId: string,
  signal: AbortSignal,
): Promise<Message[]> {
  try {
    const body = await getJson<{ messages?: unknown[] }>(
      `${RUNTIME_URL}/threads/${encodeURIComponent(threadId)}/messages`,
      { headers: { 'x-session-id': getSessionId() }, signal },
    );
    return (body.messages ?? []).map(normalizeStoredMessage) as Message[];
  } catch (err) {
    if (err instanceof HttpError) return [];
    throw err;
  }
}

export function useAgent(): UseAgentResult {
  const { agent } = useCopilotkitAgent({
    agentId: 'default',
    updates: [UseAgentUpdate.OnMessagesChanged, UseAgentUpdate.OnRunStatusChanged],
  });
  const [error, setError] = useState<string | null>(null);
  const [threadId, setThreadId] = useState(loadOrMintThreadId);

  const agentRef = useRef(agent);
  agentRef.current = agent;
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    agentRef.current.threadId = threadId;
    if (loadedFor.current === threadId) return;
    const ac = new AbortController();
    fetchThreadMessages(threadId, ac.signal)
      .then(messages => {
        loadedFor.current = threadId;
        if (messages.length > 0) agentRef.current.setMessages(messages);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => ac.abort();
  }, [threadId]);

  const busy = agent.isRunning;
  const timeline = useMemo(() => {
    const items = projectTimeline(agent.messages);
    const last = items.at(-1);
    if (busy && (last === undefined || last.kind === 'user')) {
      items.push({ kind: 'assistant', id: '__pending__', messageId: '__pending__', content: '' });
    }
    return items;
  }, [agent.messages, busy]);

  const send = useCallback(async (content: string): Promise<void> => {
    if (!content.trim() || agent.isRunning) return;
    setError(null);
    agent.addMessage({ id: crypto.randomUUID(), role: 'user', content });
    try {
      await agent.runAgent();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [agent]);

  const reset = useCallback((): void => {
    agent.setMessages([]);
    setError(null);
    setThreadId(mintThreadId());
  }, [agent]);

  return { timeline, busy, error, send, reset };
}
