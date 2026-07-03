import { type SyntheticEvent, useEffect, useRef, useState } from 'react';

interface ChatInputProps {
  busy: boolean;
  onSend: (content: string) => void;
}

export function ChatInput({ busy, onSend }: ChatInputProps): React.ReactElement {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy]);

  function handleSubmit(e: SyntheticEvent<HTMLFormElement>): void {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || busy) {
      return;
    }
    onSend(trimmed);
    setValue('');
  }

  return (
    <form className="input" onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        type="text"
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
