import { createServerFn } from '@tanstack/react-start';

import { MIDDLEWARE_URL, WIDGET_DEMO_URL } from '#/server/config';

export type RuntimeConfig = {
  widgetDemoUrl: string;
  middlewareUrl: string;
};

export const getRuntimeConfigServerFn = createServerFn({ method: 'GET' })
  .handler(async (): Promise<RuntimeConfig> => ({
    widgetDemoUrl: WIDGET_DEMO_URL,
    middlewareUrl: MIDDLEWARE_URL,
  }));
