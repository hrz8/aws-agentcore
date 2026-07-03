import { useState } from 'react';
import { z } from 'zod';
import { safeParseAny } from './ToolCard';

export const readSkillResourceArgs = z.object({
  skill_name: z.string(),
  path: z.string(),
});

type ReadResult = {
  skillName: string;
  path: string;
  content: string;
  truncated: boolean;
};

export function ReadSkillResourceCard(props: {
  name: string;
  status: 'inProgress' | 'executing' | 'complete';
  parameters: Partial<z.infer<typeof readSkillResourceArgs>>;
  result: string | undefined;
}): React.ReactElement {
  const done = props.status === 'complete';
  const [expanded, setExpanded] = useState(false);
  const parsed = done ? extractResult(props.result) : null;
  const errored = done && parsed === null && typeof props.result === 'string';

  const skillName = props.parameters.skill_name ?? '…';
  const path = props.parameters.path ?? '…';

  return (
    <div className={`tool-card tool-card--${done ? (errored ? 'error' : 'done') : 'calling'}`}>
      <div className="tool-card__head">
        <span className="tool-card__icon">{done ? (errored ? '⚠️' : '📄') : '⏳'}</span>
        <code className="tool-card__name">skill file</code>
        <span className="tool-card__summary">
          <strong>{skillName}</strong>/{path}
          {parsed?.truncated ? ' (truncated)' : ''}
        </span>
        {done && parsed !== null && (
          <button
            type="button"
            className="tool-card__toggle"
            onClick={() => setExpanded(v => !v)}
          >
            {expanded ? 'hide' : 'show'}
          </button>
        )}
      </div>
      {done && expanded && parsed !== null && (
        <div className="tool-card__body">
          <pre className="tool-card__markdown">{parsed.content}</pre>
        </div>
      )}
      {errored && (
        <div className="tool-card__body">
          <pre className="tool-card__value">{safeParseAny(props.result) as string}</pre>
        </div>
      )}
    </div>
  );
}

function extractResult(raw: string | undefined): ReadResult | null {
  const parsed = safeParseAny(raw);
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }
  const o = parsed as Record<string, unknown>;
  if (
    typeof o.skillName === 'string'
    && typeof o.path === 'string'
    && typeof o.content === 'string'
    && typeof o.truncated === 'boolean'
  ) {
    return {
      skillName: o.skillName,
      path: o.path,
      content: o.content,
      truncated: o.truncated,
    };
  }
  return null;
}
