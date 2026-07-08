import { createServerFn } from '@tanstack/react-start';

import { WIDGET_DEMO_URL } from '#/server/config';

export type RuntimeConfig = {
  widgetDemoUrl: string;
};

export const getRuntimeConfigServerFn = createServerFn({ method: 'GET' })
  .handler(async (): Promise<RuntimeConfig> => ({
    widgetDemoUrl: WIDGET_DEMO_URL,
  }));
