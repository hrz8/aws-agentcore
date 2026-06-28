import { ChatInput } from './components/ChatInput';
import { MessageList } from './components/MessageList';
import { useAgent } from './lib/useAgent';

const AGENT_URL = import.meta.env.VITE_AGENT_URL ?? '/chat';

export function App(): React.ReactElement {
  const { timeline, busy, error, send, reset } = useAgent(AGENT_URL);

  return (
    <div className="app">
      <header>
        <h1>agent demo</h1>
        <button type="button" onClick={reset} disabled={busy}>
          new thread
        </button>
      </header>
      {error && <div className="error">{error}</div>}
      <MessageList timeline={timeline} busy={busy} />
      <ChatInput busy={busy} onSend={send} />
    </div>
  );
}
