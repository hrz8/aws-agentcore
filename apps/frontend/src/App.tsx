import {
  CopilotChatConfigurationProvider,
  useDefaultRenderTool,
  useRenderTool,
} from '@copilotkit/react-core/v2';
import { useState } from 'react';

import { ChatInput } from './components/ChatInput';
import { ConvertTemperatureCard, convertTemperatureArgs } from './components/ConvertTemperatureCard';
import { MessageList } from './components/MessageList';
import { ReadSkillResourceCard, readSkillResourceArgs } from './components/ReadSkillResourceCard';
import { SearchDocumentsCard, searchDocumentsArgs } from './components/SearchDocumentsCard';
import { SearchWebCard, searchWebArgs } from './components/SearchWebCard';
import { SkillsCard, skillsArgs } from './components/SkillsCard';
import { ToolCard } from './components/ToolCard';
import { loadScope } from './lib/storage/scope';
import { loadOrMintThreadId, mintThreadId } from './lib/storage/thread';
import { useAgent } from './lib/useAgent';

export function App(): React.ReactElement {
  const [scope] = useState(loadScope);
  const [threadId, setThreadId] = useState(() => loadOrMintThreadId(scope));
  return (
    <CopilotChatConfigurationProvider threadId={threadId} hasExplicitThreadId>
      <AppContent threadId={threadId} onResetThread={() => setThreadId(mintThreadId(scope))} />
    </CopilotChatConfigurationProvider>
  );
}

interface AppContentProps {
  threadId: string;
  onResetThread: () => void;
}

function AppContent({ threadId, onResetThread }: AppContentProps): React.ReactElement {
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

  useRenderTool({
    name: 'search_web',
    parameters: searchWebArgs,
    render: SearchWebCard,
  }, []);

  useRenderTool({
    name: 'skills',
    parameters: skillsArgs,
    render: SkillsCard,
  }, []);

  useRenderTool({
    name: 'read_skill_resource',
    parameters: readSkillResourceArgs,
    render: ReadSkillResourceCard,
  }, []);

  useDefaultRenderTool({ render: ToolCard }, []);

  const { timeline, busy, error, send, reset } = useAgent({ threadId, onResetThread });

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
