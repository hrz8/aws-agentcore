import { useDefaultRenderTool, useRenderTool } from '@copilotkit/react-core/v2';

import { ChatInput } from './components/ChatInput';
import { ConvertTemperatureCard, convertTemperatureArgs } from './components/ConvertTemperatureCard';
import { MessageList } from './components/MessageList';
import { SearchDocumentsCard, searchDocumentsArgs } from './components/SearchDocumentsCard';
import { ToolCard } from './components/ToolCard';
import { Uploader } from './components/Uploader';
import { useAgent } from './lib/useAgent';

export function App(): React.ReactElement {
  useRenderTool({
    name: 'convert_temperature',
    parameters: convertTemperatureArgs,
    render: ConvertTemperatureCard,
  }, []);

  useRenderTool({
    name: 'search_documents',
    parameters: searchDocumentsArgs,
    render: SearchDocumentsCard,
  }, []);

  useDefaultRenderTool({ render: ToolCard }, []);

  const { timeline, busy, error, send, reset } = useAgent();

  return (
    <div className="app">
      <header>
        <h1>agent demo</h1>
        <Uploader />
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
