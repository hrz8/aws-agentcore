import type { Message } from '@ag-ui/client';
import { useAgent as useCopilotkitAgent, UseAgentUpdate } from '@copilotkit/react-core/v2';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AGENT_URL as DEFAULT_RUNTIME_URL } from '../env';
import { getJson, HttpError } from './http';
import { normalizeStoredMessage, projectTimeline, type TimelineItem } from './timeline';

export interface UseAgentInput {
  threadId: string;
  onResetThread: () => void;
  runtimeUrl?: string;
}

export interface UseAgentResult {
  timeline: TimelineItem[];
  busy: boolean;
  error: string | null;
  send: (content: string) => Promise<void>;
  reset: () => void;
}

async function fetchThreadMessages(
  runtimeUrl: string,
  threadId: string,
  signal: AbortSignal,
): Promise<Message[]> {
  try {
    const body = await getJson<{ messages?: unknown[] }>(
      `${runtimeUrl}/threads/${encodeURIComponent(threadId)}/messages`,
      { signal },
    );
    return (body.messages ?? []).map(normalizeStoredMessage) as Message[];
  } catch (err) {
    if (err instanceof HttpError) return [];
    throw err;
  }
}

export function useAgent({ threadId, onResetThread, runtimeUrl = DEFAULT_RUNTIME_URL }: UseAgentInput): UseAgentResult {
  const { agent } = useCopilotkitAgent({
    agentId: 'default',
    updates: [UseAgentUpdate.OnMessagesChanged, UseAgentUpdate.OnRunStatusChanged],
  });
  const [error, setError] = useState<string | null>(null);
  const [fetchedMessages, setFetchedMessages] = useState<Message[] | null>(null);

  useEffect(() => {
    setFetchedMessages(null);
    const ac = new AbortController();
    fetchThreadMessages(runtimeUrl, threadId, ac.signal)
      .then(setFetchedMessages)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => ac.abort();
  }, [threadId, runtimeUrl]);

  useEffect(() => {
    if (!fetchedMessages || fetchedMessages.length === 0) {
      return;
    }
    if (agent.messages.length > 0) {
      return;
    }
    agent.setMessages(fetchedMessages);
  }, [agent, fetchedMessages]);

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
    if (!content.trim() || agent.isRunning) {
      return;
    }
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
    onResetThread();
  }, [agent, onResetThread]);

  return {
    timeline,
    busy,
    error,
    send,
    reset,
  };
}
