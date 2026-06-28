import { CopilotKitProvider } from '@copilotkit/react-core/v2';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { getSessionId } from './lib/session';
import './styles.css';

const AGENT_URL = import.meta.env.VITE_AGENT_URL ?? '/copilotkit';

function COPILOTKIT_HEADERS(): Record<string, string> {
  const sessionId = getSessionId();
  return { 'x-session-id': sessionId };
}

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

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
