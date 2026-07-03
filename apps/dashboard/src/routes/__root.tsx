import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router';
import { type ReactNode } from 'react';

import { ErrorBoundary } from '#/components/error-boundary';
import { NotFoundPage } from '#/components/not-found-page';
import { DEV } from '#/shared/env';
import { DEFAULT_THEME, THEME_INIT_SCRIPT } from '#/shared/theme';
import { directionFor, type Locale, DEFAULT_LOCALE } from '#/shared/i18n/locale';

import appCss from '../styles/main.css?url';

export interface RootContext {
  locale: Locale;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RootContext>()({
  beforeLoad: () => ({ locale: DEFAULT_LOCALE }),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'TWAI Dashboard' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
    scripts: [{ children: THEME_INIT_SCRIPT }],
  }),
  notFoundComponent: NotFoundPage,
  component: RootComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
        {DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
      </QueryClientProvider>
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  const { locale } = Route.useRouteContext();
  return (
    <html
      lang={locale}
      dir={directionFor(locale)}
      data-theme={DEFAULT_THEME}
      suppressHydrationWarning
    >
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
