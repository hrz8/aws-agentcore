import { useState } from 'react';
import { z } from 'zod';
import { safeParseAny } from './ToolCard';

export const skillsArgs = z.object({
  skill_name: z.string(),
});

export function SkillsCard(props: {
  name: string;
  status: 'inProgress' | 'executing' | 'complete';
  parameters: Partial<z.infer<typeof skillsArgs>>;
  result: string | undefined;
}): React.ReactElement {
  const done = props.status === 'complete';
  const [expanded, setExpanded] = useState(false);
  const body = done ? extractBody(props.result) : null;
  const skillName = props.parameters.skill_name ?? '…';

  return (
    <div className={`tool-card tool-card--${done ? 'done' : 'calling'}`}>
      <div className="tool-card__head">
        <span className="tool-card__icon">{done ? '🎯' : '⏳'}</span>
        <code className="tool-card__name">skill</code>
        <span className="tool-card__summary">
          {done ? 'loaded ' : 'loading '}<strong>{skillName}</strong>
        </span>
        {done && body !== null && (
          <button
            type="button"
            className="tool-card__toggle"
            onClick={() => setExpanded(v => !v)}
          >
            {expanded ? 'hide instructions' : 'show instructions'}
          </button>
        )}
      </div>
      {done && expanded && body !== null && (
        <div className="tool-card__body">
          <pre className="tool-card__markdown">{body}</pre>
        </div>
      )}
    </div>
  );
}

function extractBody(raw: string | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const parsed = safeParseAny(raw);
  return typeof parsed === 'string' ? parsed : String(parsed);
}
