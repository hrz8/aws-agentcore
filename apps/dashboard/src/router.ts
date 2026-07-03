import { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { routerWithQueryClient } from '@tanstack/react-router-with-query';

import { ErrorPage } from '#/components/error-page';
import { NotFoundPage } from '#/components/not-found-page';
import { DEFAULT_LOCALE } from '#/shared/i18n/locale';

import { routeTree } from './routeTree.gen';

export function buildQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

export function getRouter() {
  const queryClient = buildQueryClient();
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: ErrorPage,
    defaultNotFoundComponent: NotFoundPage,
    context: {
      locale: DEFAULT_LOCALE,
      queryClient,
    },
  });
  return routerWithQueryClient(router, queryClient);
}

export type AppRouter = ReturnType<typeof getRouter>;

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter;
  }
}
