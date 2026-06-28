import type { Message } from '@ag-ui/client';
import { useAgent as useCopilotkitAgent, UseAgentUpdate } from '@copilotkit/react-core/v2';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { loadOrMintThreadId, mintThreadId } from './thread';
import { normalizeStoredMessage, projectTimeline, type TimelineItem } from './timeline';

const RUNTIME_URL = import.meta.env.VITE_AGENT_URL ?? '/copilotkit';

export interface UseAgentOptions {
  tenantId: string;
  agentId: string;
}

export interface UseAgentResult {
  timeline: TimelineItem[];
  busy: boolean;
  error: string | null;
  send: (content: string) => Promise<void>;
  reset: () => void;
}

async function fetchThreadMessages(
  tenantId: string,
  agentId: string,
  threadId: string,
  signal: AbortSignal,
): Promise<Message[]> {
  const res = await fetch(
    `${RUNTIME_URL}/threads/${encodeURIComponent(threadId)}/messages`,
    {
      headers: {
        'x-tenant-id': tenantId,
        'x-agent-id': agentId,
        'x-thread-id': threadId,
      },
      signal,
    },
  );
  if (!res.ok) return [];
  const body = await res.json() as { messages?: unknown[] };
  return (body.messages ?? []).map(normalizeStoredMessage) as Message[];
}

export function useAgent({ tenantId, agentId }: UseAgentOptions): UseAgentResult {
  const { agent } = useCopilotkitAgent({
    agentId: 'default',
    updates: [UseAgentUpdate.OnMessagesChanged, UseAgentUpdate.OnRunStatusChanged],
  });
  const [error, setError] = useState<string | null>(null);
  const [threadId, setThreadId] = useState(loadOrMintThreadId);

  useEffect(() => {
    agent.threadId = threadId;
    const ac = new AbortController();
    fetchThreadMessages(tenantId, agentId, threadId, ac.signal)
      .then(messages => {
        if (messages.length > 0) agent.setMessages(messages);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => ac.abort();
  }, [agent, tenantId, agentId, threadId]);

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
