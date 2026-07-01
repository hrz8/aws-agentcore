import { useEffect, useRef, useState } from 'react';
import {
  deleteSkill,
  listSkills,
  uploadSkill,
  type SkillSummary,
} from '../lib/skillsApi';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'uploading'; filename: string }
  | { kind: 'ok'; message: string }
  | { kind: 'error'; message: string };

export function SkillsUploader(): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [status, setStatus] = useState<Status>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void refresh(cancelled).catch(err => {
      if (cancelled) return;
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    });
    return () => { cancelled = true; };
  }, []);

  async function refresh(cancelled = false): Promise<void> {
    const res = await listSkills();
    if (cancelled) return;
    setSkills(res.skills);
    setStatus({ kind: 'idle' });
  }

  const busy = status.kind === 'uploading' || status.kind === 'loading';

  const onPick = (): void => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setStatus({ kind: 'uploading', filename: file.name });
    try {
      const result = await uploadSkill(file);
      await refresh();
      setStatus({
        kind: 'ok',
        message: `uploaded ${result.name}${result.resourceCount > 0 ? ` (${result.resourceCount} resource file${result.resourceCount === 1 ? '' : 's'})` : ''}`,
      });
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  };

  async function onDelete(name: string): Promise<void> {
    if (!window.confirm(`Delete skill "${name}"?`)) return;
    setStatus({ kind: 'loading' });
    try {
      await deleteSkill(name);
      await refresh();
      setStatus({ kind: 'ok', message: `deleted ${name}` });
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <div className="skills">
      <input
        ref={inputRef}
        type="file"
        accept=".md,.zip"
        style={{ display: 'none' }}
        onChange={onFile}
      />
      <button type="button" onClick={onPick} disabled={busy}>
        upload skill
      </button>
      {skills.length > 0 && (
        <details className="skills__details">
          <summary>{skills.length} skill{skills.length === 1 ? '' : 's'}</summary>
          <ul className="skills__list">
            {skills.map(s => (
              <li key={s.name}>
                <div className="skills__row">
                  <code className="skills__name">{s.name}</code>
                  <button
                    type="button"
                    className="skills__delete"
                    onClick={() => onDelete(s.name)}
                    disabled={busy}
                    title="delete"
                  >
                    ✕
                  </button>
                </div>
                <div className="skills__desc">{s.description}</div>
              </li>
            ))}
          </ul>
        </details>
      )}
      <StatusLine status={status} />
    </div>
  );
}

function StatusLine({ status }: { status: Status }): React.ReactElement | null {
  switch (status.kind) {
    case 'idle':      return null;
    case 'loading':   return <span className="skills__status">loading…</span>;
    case 'uploading': return <span className="skills__status">⏫ uploading {status.filename}…</span>;
    case 'ok':        return <span className="skills__status skills__status--ok">✓ {status.message}</span>;
    case 'error':     return <span className="skills__status skills__status--err">⚠ {status.message}</span>;
  }
}
