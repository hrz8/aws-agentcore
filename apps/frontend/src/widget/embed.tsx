(function ensureProcess(): void {
  const g = globalThis as { process?: { env: Record<string, string | undefined> } };
  if (typeof g.process === 'undefined') {
    g.process = { env: {} };
  } else if (typeof g.process.env === 'undefined') {
    g.process.env = {};
  }
})();

import { CopilotKitProvider } from '@copilotkit/react-core/v2';
import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { getActorId } from '../lib/storage/actor';
import {
  buildHeaders,
  resolveConfig,
  type Nd8Config,
  type Nd8ConfigInput,
} from './config';
import { WidgetShell, type WidgetHandle } from './WidgetShell';
import widgetCss from './widget.css?inline';

export interface Nd8Api {
  init: (config: Nd8ConfigInput) => void;
  destroy: () => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
  newThread: () => void;
  setConfig: (patch: Partial<Nd8ConfigInput>) => void;
}

declare global {
  interface Window {
    nd8?: Nd8Api;
    nd8Config?: Nd8ConfigInput;
  }
}

class WidgetInstance {
  private root: Root | null = null;
  private host: HTMLDivElement | null = null;
  private mountTarget: Element;
  private config: Nd8Config;
  private handleRef: { current: WidgetHandle | null } = { current: null };

  constructor(config: Nd8Config, target: Element) {
    this.config = config;
    this.mountTarget = target;
    this.render();
  }

  private render(): void {
    const host = document.createElement('div');
    host.setAttribute('data-nd8-widget', '');
    this.mountTarget.appendChild(host);
    this.host = host;

    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = widgetCss;
    shadow.appendChild(style);

    if (this.config.theme.primary) {
      const themeStyle = document.createElement('style');
      themeStyle.textContent = `:host { --nd8-primary: ${escapeCss(this.config.theme.primary)}; }`;
      shadow.appendChild(themeStyle);
    }

    const mountPoint = document.createElement('div');
    shadow.appendChild(mountPoint);

    const actorId = this.config.actorId ?? getActorId();
    const headers = (): Record<string, string> => buildHeaders(this.config, actorId);

    this.root = createRoot(mountPoint);
    this.root.render(
      <StrictMode>
        <CopilotKitProvider runtimeUrl={this.config.agentUrl} headers={headers}>
          <WidgetShell config={this.config} handleRef={this.handleRef} />
        </CopilotKitProvider>
      </StrictMode>,
    );
  }

  destroy(): void {
    this.root?.unmount();
    this.host?.remove();
    this.root = null;
    this.host = null;
    this.handleRef.current = null;
  }

  open(): void { this.handleRef.current?.open(); }
  close(): void { this.handleRef.current?.close(); }
  toggle(): void { this.handleRef.current?.toggle(); }
  newThread(): void { this.handleRef.current?.newThread(); }

  setConfig(patch: Partial<Nd8ConfigInput>): void {
    const next = resolveConfig({ ...this.config, ...patch });
    this.destroy();
    this.config = next;
    this.render();
  }
}

function escapeCss(value: string): string {
  // CSS variable value fed into a <style> tag — reject anything with a closing brace.
  return value.replace(/[<>{}]/g, '');
}

function resolveTarget(sel: string | HTMLElement | undefined): Element {
  if (!sel) return document.body;
  if (typeof sel === 'string') {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`nd8Config.targetElement '${sel}' not found`);
    return el;
  }
  return sel;
}

let instance: WidgetInstance | null = null;

const api: Nd8Api = {
  init(input) {
    instance?.destroy();
    const config = resolveConfig(input);
    instance = new WidgetInstance(config, resolveTarget(config.targetElement));
  },
  destroy() {
    instance?.destroy();
    instance = null;
  },
  open() { instance?.open(); },
  close() { instance?.close(); },
  toggle() { instance?.toggle(); },
  newThread() { instance?.newThread(); },
  setConfig(patch) { instance?.setConfig(patch); },
};

window.nd8 = api;

function autoInit(): void {
  if (window.nd8Config) {
    try {
      api.init(window.nd8Config);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[nd8] widget init failed:', err);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoInit, { once: true });
} else {
  autoInit();
}
