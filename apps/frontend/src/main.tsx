import { CopilotKitProvider } from '@copilotkit/react-core/v2';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { AGENT_URL } from './env';
import { getActorId } from './lib/storage/actor';
import { adoptScopeFromUrl, loadScope } from './lib/storage/scope';
import './styles.css';

adoptScopeFromUrl();

function COPILOTKIT_HEADERS(): Record<string, string> {
  const scope = loadScope();
  const headers: Record<string, string> = {
    'x-actor-id': getActorId(),
  };
  if (scope) {
    headers['x-tenant-id'] = scope.tenantId;
    headers['x-agent-id'] = scope.agentId;
    headers['x-agent-version'] = scope.agentVersion;
  }
  return headers;
}

const root = document.getElementById('root');
if (!root) {
  throw new Error('#root not found');
}

createRoot(root).render(
  <StrictMode>
    <CopilotKitProvider
      runtimeUrl={AGENT_URL}
      headers={COPILOTKIT_HEADERS}
    >
      <App />
    </CopilotKitProvider>
  </StrictMode>,
);
