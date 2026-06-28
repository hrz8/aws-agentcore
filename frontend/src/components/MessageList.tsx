import { useLayoutEffect, useRef } from 'react';
import type { TimelineItem } from '../lib/useAgent';
import { ToolCard } from './ToolCard';

interface MessageListProps {
  timeline: TimelineItem[];
  busy: boolean;
}

const STICK_THRESHOLD = 40;

export function MessageList({ timeline, busy }: MessageListProps): React.ReactElement {
    const containerRef = useRef<HTMLDivElement | null>(null);
  const wasAtBottomRef = useRef(true);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (wasAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [timeline, busy]);

  function handleScroll(): void {
    const el = containerRef.current;
    if (!el) return;
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
        return <ToolCard key={item.id} item={item} />;
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
        {content}
        {streaming ? <span className="cursor">▎</span> : null}
      </div>
    </div>
  );
}
