import { useRenderToolCall } from '@copilotkit/react-core/v2';
import { useLayoutEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { TimelineItem } from '../lib/timeline';

interface MessageListProps {
  timeline: TimelineItem[];
  busy: boolean;
}

const STICK_THRESHOLD = 40;

export function MessageList({ timeline, busy }: MessageListProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wasAtBottomRef = useRef(true);
  const renderToolCall = useRenderToolCall();

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    if (wasAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [timeline, busy]);

  function handleScroll(): void {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    wasAtBottomRef.current = distanceFromBottom <= STICK_THRESHOLD;
  }

  if (timeline.length === 0) {
    return (
      <div className="empty">
        <p>Try: <em>convert 0 C to F</em></p>
      </div>
    );
  }

  return (
    <div className="messages" ref={containerRef} onScroll={handleScroll}>
      {timeline.map((item, idx) => {
        if (item.kind === 'user') {
          return <Bubble key={item.id} role="user" content={item.content} />;
        }
        if (item.kind === 'assistant') {
          const isLast = idx === timeline.length - 1;
          return (
            <Bubble
              key={item.id}
              role="assistant"
              content={item.content}
              streaming={isLast && busy && item.content.length === 0}
            />
          );
        }
        return (
          <div key={item.id}>
            {renderToolCall({ toolCall: item.toolCall, toolMessage: item.toolMessage })}
          </div>
        );
      })}
    </div>
  );
}

function Bubble({
  role,
  content,
  streaming = false,
}: {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}): React.ReactElement {
  return (
    <div className={`bubble bubble--${role}`}>
      <div className="bubble__role">{role}</div>
      <div className="bubble__content">
        {role === 'assistant' ? (
          <div className="markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        ) : (
          content
        )}
        {streaming ? <span className="cursor">▎</span> : null}
      </div>
    </div>
  );
}
