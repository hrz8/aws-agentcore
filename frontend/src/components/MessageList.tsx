import type { TimelineItem } from '../lib/useAgent';

interface MessageListProps {
  timeline: TimelineItem[];
  busy: boolean;
}

export function MessageList({ timeline, busy }: MessageListProps): React.ReactElement {
  if (timeline.length === 0) {
    return (
      <div className="empty">
        <p>Try: <em>convert 0 C to F</em></p>
      </div>
    );
  }

  return (
    <div className="messages">
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

function ToolCard({
  item,
}: {
  item: Extract<TimelineItem, { kind: 'tool' }>;
}): React.ReactElement {
  const isDone = item.status === 'done';
  return (
    <div className={`tool-card tool-card--${item.status}`}>
      <div className="tool-card__head">
        <span className="tool-card__icon">{isDone ? '✓' : '⏳'}</span>
        <code className="tool-card__name">{item.name}</code>
      </div>
      {item.args !== undefined && (
        <Section label="args" value={item.args} />
      )}
      {item.result !== undefined && (
        <Section label="result" value={item.result} />
      )}
    </div>
  );
}

function Section({ label, value }: { label: string; value: unknown }): React.ReactElement {
  const rendered = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return (
    <div className="tool-card__section">
      <div className="tool-card__label">{label}</div>
      <pre className="tool-card__value">{rendered}</pre>
    </div>
  );
}
