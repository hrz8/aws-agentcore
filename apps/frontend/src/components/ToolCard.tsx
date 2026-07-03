import { Section } from './Section';

export function ToolCard(props: {
  name: string;
  status: 'inProgress' | 'executing' | 'complete';
  parameters: unknown;
  result: string | undefined;
}): React.ReactElement {
  const done = props.status === 'complete';
  const parsedResult = done ? safeParseAny(props.result) : undefined;
  return (
    <div className={`tool-card tool-card--${done ? 'done' : 'calling'}`}>
      <div className="tool-card__head">
        <span className="tool-card__icon">{done ? '✓' : '⏳'}</span>
        <code className="tool-card__name">{props.name}</code>
      </div>
      {hasContent(props.parameters) && <Section label="args" value={props.parameters} />}
      {parsedResult !== undefined && <Section label="result" value={parsedResult} />}
    </div>
  );
}

export function safeParseAny(raw: string | undefined): unknown {
  if (typeof raw !== 'string') {
    return raw;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function hasContent(v: unknown): boolean {
  if (v === undefined || v === null) {
    return false;
  }
  if (typeof v === 'object') {
    return Object.keys(v).length > 0;
  }
  return true;
}
