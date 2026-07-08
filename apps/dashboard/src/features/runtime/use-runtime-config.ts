import { getRouteApi } from '@tanstack/react-router';

import type { RuntimeConfig } from './server-fns';

const rootApi = getRouteApi('__root__');

export function useRuntimeConfig(): RuntimeConfig {
  return rootApi.useLoaderData();
}
