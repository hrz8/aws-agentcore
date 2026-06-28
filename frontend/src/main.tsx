import { CopilotKitProvider } from '@copilotkit/react-core/v2';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { loadOrMintThreadId } from './lib/thread';
import './styles.css';

const AGENT_URL = import.meta.env.VITE_AGENT_URL ?? '/copilotkit';
const TENANT_ID = 'demo';
const AGENT_ID = 'simple';

function COPILOTKIT_HEADERS(): Record<string, string> {
  return {
    'x-tenant-id': TENANT_ID,
    'x-agent-id': AGENT_ID,
    'x-thread-id': loadOrMintThreadId(),
  };
}

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

createRoot(root).render(
  <StrictMode>
    <CopilotKitProvider
      runtimeUrl={AGENT_URL}
      headers={COPILOTKIT_HEADERS}
    >
      <App tenantId={TENANT_ID} agentId={AGENT_ID} />
    </CopilotKitProvider>
  </StrictMode>,
);
