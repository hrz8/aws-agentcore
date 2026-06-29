import { z } from 'zod';
import { Section } from './Section';
import { safeParseAny } from './ToolCard';

export const searchWebArgs = z.object({
  query: z.string(),
  maxResults: z.number().int().optional(),
});

type Source = { url: string; host: string };
type Hit = { text: string; score: number; source: Source };

export function SearchWebCard(props: {
  name: string;
  status: 'inProgress' | 'executing' | 'complete';
  parameters: Partial<z.infer<typeof searchWebArgs>>;
  result: string | undefined;
}): React.ReactElement {
  const done = props.status === 'complete';
  const parsed = done ? safeParseAny(props.result) : undefined;
  const results = extractResults(parsed);

  return (
    <div className={`tool-card tool-card--${done ? 'done' : 'calling'}`}>
      <div className="tool-card__head">
        <span className="tool-card__icon">{done ? '🌐' : '⏳'}</span>
        <code className="tool-card__name">{props.name}</code>
        <span className="tool-card__summary">
          {props.parameters.query ? `"${props.parameters.query}"` : '…'}
          {done && results !== null ? ` — ${results.length} hits` : ''}
        </span>
      </div>
      {done && results !== null && results.length > 0 && (
        <div className="tool-card__body">
          <ul className="citations">
            {results.map((hit, i) => (
              <li key={i}>
                <a
                  href={hit.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="citations__link"
                  title={hit.source.url}
                >
                  {hit.source.host || hit.source.url}
                </a>
                {' '}<span className="citations__score">{hit.score.toFixed(3)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {done && results !== null && results.length === 0 && (
        <div className="tool-card__body"><em>no matches</em></div>
      )}
      {done && results === null && parsed !== undefined && (
        <Section label="result" value={parsed} />
      )}
    </div>
  );
}

function extractResults(parsed: unknown): Hit[] | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.results)) return null;
  return obj.results.filter(isHit);
}

function isHit(v: unknown): v is Hit {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (typeof o.text !== 'string' || typeof o.score !== 'number') return false;
  if (!o.source || typeof o.source !== 'object') return false;
  const s = o.source as Record<string, unknown>;
  return typeof s.url === 'string' && typeof s.host === 'string';
}
