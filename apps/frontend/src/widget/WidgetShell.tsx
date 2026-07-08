import {
  CopilotChatConfigurationProvider,
  useDefaultRenderTool,
  useRenderTool,
} from '@copilotkit/react-core/v2';
import { useState } from 'react';

import { ChatInput } from '../components/ChatInput';
import { ConvertTemperatureCard, convertTemperatureArgs } from '../components/ConvertTemperatureCard';
import { MessageList } from '../components/MessageList';
import { ReadSkillResourceCard, readSkillResourceArgs } from '../components/ReadSkillResourceCard';
import { SearchDocumentsCard, searchDocumentsArgs } from '../components/SearchDocumentsCard';
import { SearchWebCard, searchWebArgs } from '../components/SearchWebCard';
import { SkillsCard, skillsArgs } from '../components/SkillsCard';
import { ToolCard } from '../components/ToolCard';
import { loadOrMintThreadId, mintThreadId } from '../lib/storage/thread';
import { useAgent } from '../lib/useAgent';
import type { Nd8Config } from './config';

export interface WidgetHandle {
  open: () => void;
  close: () => void;
  toggle: () => void;
  newThread: () => void;
}

export interface WidgetShellProps {
  config: Nd8Config;
  handleRef?: { current: WidgetHandle | null };
}

export function WidgetShell({ config, handleRef }: WidgetShellProps): React.ReactElement {
  const [open, setOpen] = useState<boolean>(config.initiallyOpen);
  const scope = {
    tenantId: config.tenantId,
    agentId: config.agentId,
    agentVersion: config.agentVersion,
  };
  const [threadId, setThreadId] = useState<string>(() => loadOrMintThreadId(scope));

  if (handleRef) {
    handleRef.current = {
      open: () => setOpen(true),
      close: () => setOpen(false),
      toggle: () => setOpen((v) => !v),
      newThread: () => setThreadId(mintThreadId(scope)),
    };
  }

  return (
    <div className="nd8-root">
      {open && (
        <div className="nd8-panel" data-position={config.position}>
          <div className="nd8-panel__header">
            <span>{config.title}</span>
            <button
              type="button"
              className="nd8-panel__close"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              ×
            </button>
          </div>
          <div className="nd8-panel__body">
            <CopilotChatConfigurationProvider threadId={threadId} hasExplicitThreadId>
              <PanelContent
                config={config}
                threadId={threadId}
                onResetThread={() => setThreadId(mintThreadId(scope))}
              />
            </CopilotChatConfigurationProvider>
          </div>
        </div>
      )}
      <button
        type="button"
        className="nd8-launcher"
        data-position={config.position}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        <svg className="nd8-launcher__icon" viewBox="0 0 24 24" aria-hidden="true">
          {open ? (
            <path d="M6.4 4.99 12 10.59l5.6-5.6 1.41 1.41L13.41 12l5.6 5.6-1.41 1.41L12 13.41l-5.6 5.6-1.41-1.41L10.59 12 4.99 6.4z" />
          ) : (
            <path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2Z" />
          )}
        </svg>
      </button>
    </div>
  );
}

interface PanelContentProps {
  config: Nd8Config;
  threadId: string;
  onResetThread: () => void;
}

function PanelContent({ config, threadId, onResetThread }: PanelContentProps): React.ReactElement {
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

  const { timeline, busy, error, send } = useAgent({
    threadId,
    onResetThread,
    runtimeUrl: config.agentUrl,
  });

  return (
    <div className="app">
      {error && <div className="error">{error}</div>}
      <MessageList timeline={timeline} busy={busy} />
      <ChatInput busy={busy} onSend={send} />
    </div>
  );
}
