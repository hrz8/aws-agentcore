import { type FormEvent, useState } from 'react';

interface ChatInputProps {
  busy: boolean;
  onSend: (content: string) => void;
}

export function ChatInput({ busy, onSend }: ChatInputProps): React.ReactElement {
  const [value, setValue] = useState('');

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    onSend(trimmed);
    setValue('');
  }

  return (
    <form className="input" onSubmit={handleSubmit}>
      <input
        type="text"
        autoFocus
        placeholder={busy ? 'thinking…' : 'message the agent'}
        value={value}
        onChange={e => setValue(e.target.value)}
        disabled={busy}
      />
      <button type="submit" disabled={busy || !value.trim()}>
        send
      </button>
    </form>
  );
}
