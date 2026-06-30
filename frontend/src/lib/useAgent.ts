import type { Message } from '@ag-ui/client';
import { useAgent as useCopilotkitAgent, UseAgentUpdate } from '@copilotkit/react-core/v2';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getJson, HttpError } from './http';
import { normalizeStoredMessage, projectTimeline, type TimelineItem } from './timeline';

const RUNTIME_URL = import.meta.env.VITE_AGENT_URL ?? '/copilotkit';

export interface UseAgentInput {
  threadId: string;
  onResetThread: () => void;
}

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
      { signal },
    );
    return (body.messages ?? []).map(normalizeStoredMessage) as Message[];
  } catch (err) {
    if (err instanceof HttpError) return [];
    throw err;
  }
}

export function useAgent({ threadId, onResetThread }: UseAgentInput): UseAgentResult {
  const { agent } = useCopilotkitAgent({
    agentId: 'default',
    updates: [UseAgentUpdate.OnMessagesChanged, UseAgentUpdate.OnRunStatusChanged],
  });
  const [error, setError] = useState<string | null>(null);
  // History fetched for the current threadId. `null` while loading; `[]` when the thread has
  // no prior turns. Kept in state (not a ref) so the apply effect re-runs when it arrives.
  const [fetchedMessages, setFetchedMessages] = useState<Message[] | null>(null);

  useEffect(() => {
    setFetchedMessages(null);
    const ac = new AbortController();
    fetchThreadMessages(threadId, ac.signal)
      .then(setFetchedMessages)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => ac.abort();
  }, [threadId]);

  // Apply fetched history to whichever Agent instance CopilotKit is currently exposing.
  // CopilotKit may swap the Agent reference across StrictMode remounts / thread changes, and
  // a setMessages on the prior instance is invisible to the new one — so we re-apply whenever
  // the agent or fetched payload changes. The `agent.messages.length > 0` guard prevents
  // clobbering an active conversation.
  useEffect(() => {
    if (!fetchedMessages || fetchedMessages.length === 0) return;
    if (agent.messages.length > 0) return;
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
    onResetThread();
  }, [agent, onResetThread]);

  return { timeline, busy, error, send, reset };
}
