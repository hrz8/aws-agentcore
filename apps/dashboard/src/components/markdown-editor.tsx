import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import { Eye, Pencil, SplitSquareHorizontal } from 'lucide-react';
import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { parse as parseYaml } from 'yaml';

import { m } from '#/paraglide/messages.js';
import { Button } from '#/components/ui/button';
import { cn } from '#/shared/utils';

export const MarkdownViewMode = {
  Edit: 'edit',
  Split: 'split',
  Preview: 'preview',
} as const;
export type MarkdownViewMode = typeof MarkdownViewMode[keyof typeof MarkdownViewMode];

const CM_EXTENSIONS = [
  markdown({ base: markdownLanguage }),
  EditorView.lineWrapping,
];

interface MarkdownEditorProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  height?: string;
  placeholder?: string;
  initialMode?: MarkdownViewMode;
  className?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  disabled = false,
  height = '60vh',
  placeholder,
  initialMode = MarkdownViewMode.Edit,
  className,
}: MarkdownEditorProps) {
  const [mode, setMode] = React.useState<MarkdownViewMode>(initialMode);

  const handleChange = React.useCallback(
    (next: string) => onChange(next),
    [onChange],
  );

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-end gap-1">
        <ModeButton
          active={mode === MarkdownViewMode.Edit}
          onClick={() => setMode(MarkdownViewMode.Edit)}
          icon={<Pencil className="h-3.5 w-3.5" />}
          label={m.markdown_editor_view_edit()}
        />
        <ModeButton
          active={mode === MarkdownViewMode.Split}
          onClick={() => setMode(MarkdownViewMode.Split)}
          icon={<SplitSquareHorizontal className="h-3.5 w-3.5" />}
          label={m.markdown_editor_view_split()}
        />
        <ModeButton
          active={mode === MarkdownViewMode.Preview}
          onClick={() => setMode(MarkdownViewMode.Preview)}
          icon={<Eye className="h-3.5 w-3.5" />}
          label={m.markdown_editor_view_preview()}
        />
      </div>
      <div
        className={cn(
          'grid gap-3',
          mode === MarkdownViewMode.Split
            ? 'grid-cols-1 lg:grid-cols-2'
            : 'grid-cols-1',
        )}
      >
        {mode !== MarkdownViewMode.Preview ? (
          <div className="overflow-hidden rounded-md border">
            <CodeMirror
              value={value}
              height={height}
              extensions={CM_EXTENSIONS}
              onChange={handleChange}
              editable={!disabled}
              placeholder={placeholder}
              theme="dark"
              basicSetup={{
                lineNumbers: true,
                highlightActiveLine: true,
                autocompletion: false,
                foldGutter: true,
              }}
            />
          </div>
        ) : null}
        {mode !== MarkdownViewMode.Edit ? (
          <div
            className="overflow-auto rounded-md border bg-background p-4"
            style={{ height }}
          >
            {value.trim().length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {m.markdown_editor_preview_empty()}
              </p>
            ) : (
              <MarkdownPreview value={value} />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Button
      type="button"
      variant={active ? 'default' : 'outline'}
      size="sm"
      className="h-7 px-2 text-xs"
      onClick={onClick}
      aria-pressed={active}
    >
      <span className="mr-1.5 inline-flex">{icon}</span>
      {label}
    </Button>
  );
}

const MARKDOWN_PROSE = [
  'text-sm leading-relaxed',
  '[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold',
  '[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold',
  '[&_h3]:mt-3 [&_h3]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold',
  '[&_h4]:mt-3 [&_h4]:mb-1 [&_h4]:text-sm [&_h4]:font-semibold',
  '[&_p]:my-2',
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5',
  '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_li]:my-0.5',
  '[&_a]:text-primary [&_a]:underline',
  '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs',
  '[&_pre]:my-3 [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/40 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
  '[&_hr]:my-4 [&_hr]:border-border',
  '[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs',
  '[&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold',
  '[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1',
].join(' ');

export function MarkdownPreview({ value }: { value: string }) {
  const { frontmatter, body } = React.useMemo(() => splitFrontmatter(value), [value]);
  return (
    <div className={MARKDOWN_PROSE}>
      {frontmatter ? <FrontmatterTable data={frontmatter} /> : null}
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
    </div>
  );
}

function splitFrontmatter(
  text: string,
): { frontmatter: Record<string, unknown> | null; body: string } {
  const normalised = text.replace(/\r\n/g, '\n');
  if (!normalised.startsWith('---\n')) {
    return { frontmatter: null, body: text };
  }
  const endIdx = normalised.indexOf('\n---\n', 4);
  if (endIdx < 0) {
    return { frontmatter: null, body: text };
  }
  const yamlText = normalised.slice(4, endIdx);
  const body = normalised.slice(endIdx + 5);
  try {
    const parsed = parseYaml(yamlText);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { frontmatter: parsed as Record<string, unknown>, body };
    }
  } catch {
    /* fall through */
  }
  return { frontmatter: null, body: text };
}

function FrontmatterTable({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;
  return (
    <table>
      <tbody>
        {entries.map(([key, value]) => (
          <tr key={key}>
            <th className="w-40 whitespace-nowrap align-top">{key}</th>
            <td className="align-top">{stringifyFrontmatterValue(value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function stringifyFrontmatterValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map((v) => stringifyFrontmatterValue(v)).join(', ');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}
