import {
  CopilotChatConfigurationProvider,
  useDefaultRenderTool,
  useRenderTool,
} from '@copilotkit/react-core/v2';
import { useEffect, useState } from 'react';

import { ChatInput } from './components/ChatInput';
import { ConvertTemperatureCard, convertTemperatureArgs } from './components/ConvertTemperatureCard';
import { MessageList } from './components/MessageList';
import { ReadSkillResourceCard, readSkillResourceArgs } from './components/ReadSkillResourceCard';
import { SearchDocumentsCard, searchDocumentsArgs } from './components/SearchDocumentsCard';
import { SearchWebCard, searchWebArgs } from './components/SearchWebCard';
import { SkillsCard, skillsArgs } from './components/SkillsCard';
import { ToolCard } from './components/ToolCard';
import { fetchScopeDetails, type ScopeDetails } from './lib/scope-lookup';
import { loadScope, type Scope } from './lib/storage/scope';
import { loadOrMintThreadId, mintThreadId } from './lib/storage/thread';
import { useAgent } from './lib/useAgent';

type ScopeState =
  | { kind: 'checking'; scope: Scope }
  | { kind: 'missing' }
  | { kind: 'not-found'; scope: Scope }
  | { kind: 'error'; scope: Scope; message: string }
  | { kind: 'ready'; scope: Scope; details: ScopeDetails };

export function App(): React.ReactElement {
  const [scopeState, setScopeState] = useState<ScopeState>(() => {
    const scope = loadScope();
    return scope ? { kind: 'checking', scope } : { kind: 'missing' };
  });

  useEffect(() => {
    if (scopeState.kind !== 'checking') {
      return;
    }
    const ac = new AbortController();
    fetchScopeDetails(scopeState.scope, ac.signal)
      .then((result) => {
        if (ac.signal.aborted) return;
        if (result.kind === 'ok') {
          setScopeState({ kind: 'ready', scope: scopeState.scope, details: result.details });
        } else if (result.kind === 'not-found') {
          setScopeState({ kind: 'not-found', scope: scopeState.scope });
        } else {
          setScopeState({ kind: 'error', scope: scopeState.scope, message: result.message });
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setScopeState({
          kind: 'error',
          scope: scopeState.scope,
          message: err instanceof Error ? err.message : String(err),
        });
      });
    return () => ac.abort();
  }, [scopeState]);

  if (scopeState.kind === 'missing') {
    return <NotFoundScreen reason="no scope in sessionStorage or URL" />;
  }
  if (scopeState.kind === 'not-found') {
    return <NotFoundScreen reason="tenant or agent not found" scope={scopeState.scope} />;
  }
  if (scopeState.kind === 'error') {
    return <NotFoundScreen reason={scopeState.message} scope={scopeState.scope} />;
  }
  if (scopeState.kind === 'checking') {
    return (
      <div className="app">
        <header>
          <h1>agent demo</h1>
        </header>
        <p style={{ padding: '1rem' }}>Loading scope…</p>
      </div>
    );
  }

  return <ReadyApp details={scopeState.details} />;
}

interface ReadyAppProps {
  details: ScopeDetails;
}

function ReadyApp({ details }: ReadyAppProps): React.ReactElement {
  const scope: Scope = {
    tenantId: details.tenantId,
    agentId: details.agentId,
    agentVersion: details.agentVersion,
  };
  const [threadId, setThreadId] = useState(() => loadOrMintThreadId(scope));
  return (
    <CopilotChatConfigurationProvider threadId={threadId} hasExplicitThreadId>
      <AppContent
        details={details}
        threadId={threadId}
        onResetThread={() => setThreadId(mintThreadId(scope))}
      />
    </CopilotChatConfigurationProvider>
  );
}

interface AppContentProps {
  details: ScopeDetails;
  threadId: string;
  onResetThread: () => void;
}

function AppContent({ details, threadId, onResetThread }: AppContentProps): React.ReactElement {
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
        <div className="scope-header">
          <h1>{details.agentSlug}</h1>
          <div className="scope-sub">
            <span className="scope-tenant">{details.tenantName}</span>
            <span className="scope-sep">·</span>
            <code className="scope-version">{details.agentVersion}</code>
          </div>
        </div>
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

interface NotFoundScreenProps {
  reason: string;
  scope?: Scope;
}

function NotFoundScreen({ reason, scope }: NotFoundScreenProps): React.ReactElement {
  return (
    <div className="app">
      <header>
        <h1>Not found</h1>
      </header>
      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <p>The requested tenant/agent scope could not be resolved.</p>
        <p style={{ opacity: 0.7 }}>Reason: {reason}</p>
        {scope ? (
          <pre
            style={{
              padding: '0.75rem',
              background: 'rgba(0,0,0,0.05)',
              borderRadius: '0.5rem',
              fontSize: '0.85rem',
              overflowX: 'auto',
            }}
          >
{`tenantId:     ${scope.tenantId}
agentId:      ${scope.agentId}
agentVersion: ${scope.agentVersion}`}
          </pre>
        ) : (
          <p style={{ opacity: 0.7 }}>
            Launch this app with <code>?tenant=…&amp;agent=…&amp;version=…</code> or set a scope in sessionStorage.
          </p>
        )}
      </div>
    </div>
  );
}
