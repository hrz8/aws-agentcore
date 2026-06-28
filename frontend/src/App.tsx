import { useDefaultRenderTool, useRenderTool } from '@copilotkit/react-core/v2';

import { ChatInput } from './components/ChatInput';
import { ConvertTemperatureCard, convertTemperatureArgs } from './components/ConvertTemperatureCard';
import { MessageList } from './components/MessageList';
import { ToolCard } from './components/ToolCard';
import { useAgent } from './lib/useAgent';

export function App(): React.ReactElement {
  useRenderTool({
    name: 'convert_temperature',
    parameters: convertTemperatureArgs,
    render: ConvertTemperatureCard,
  }, []);

  useDefaultRenderTool({ render: ToolCard }, []);

  const { timeline, busy, error, send, reset } = useAgent();

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
