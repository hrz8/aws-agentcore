import { z } from 'zod';
import { Section } from './Section';
import { safeParseAny } from './ToolCard';

export const convertTemperatureArgs = z.object({
  from: z.enum(['celsius', 'fahrenheit']),
  value: z.number(),
});

const UNIT: Record<string, string> = { celsius: 'C', fahrenheit: 'F' };

export function ConvertTemperatureCard(props: {
  name: string;
  status: 'inProgress' | 'executing' | 'complete';
  parameters: Partial<z.infer<typeof convertTemperatureArgs>>;
  result: string | undefined;
}): React.ReactElement {
  const done = props.status === 'complete';
  const parsedResult = done ? safeParseAny(props.result) : undefined;
  const summary = done ? extractSummary(parsedResult) : null;
  const from = props.parameters.from;
  const to = from === 'celsius' ? 'fahrenheit' : 'celsius';
  return (
    <div className={`tool-card tool-card--${done ? 'done' : 'calling'}`}>
      <div className="tool-card__head">
        <span className="tool-card__icon">{done ? '✓' : '⏳'}</span>
        <code className="tool-card__name">{props.name}</code>
        <span className="tool-card__summary">
          {props.parameters.value ?? '…'}°{from ? UNIT[from] : '?'}
          {' → '}
          {summary?.result ?? '…'}°{UNIT[to]}
        </span>
      </div>
      {Object.keys(props.parameters).length > 0 && (
        <Section label="args" value={props.parameters} />
      )}
      {parsedResult !== undefined && <Section label="result" value={parsedResult} />}
    </div>
  );
}

function extractSummary(parsed: unknown): { result?: number; to?: string } | null {
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }
  const obj = parsed as Record<string, unknown>;
  return {
    result: typeof obj.result === 'number' ? obj.result : undefined,
    to: typeof obj.to === 'string' ? obj.to : undefined,
  };
}
