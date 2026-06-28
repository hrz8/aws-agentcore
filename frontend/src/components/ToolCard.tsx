import type { TimelineItem } from "../lib/useAgent";
import { Section } from "./Section";

export function ToolCard({
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
