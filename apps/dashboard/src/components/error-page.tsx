import { type ErrorComponentProps, Link, useRouter } from '@tanstack/react-router';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';

import { AppErrorView } from '#/components/app-error-view';
import { Button } from '#/components/ui/button';
import { m } from '#/paraglide/messages.js';
import { DEV } from '#/shared/env';

export function ErrorPage({ error, info, reset }: ErrorComponentProps<unknown>) {
  const router = useRouter();

  const handleRetry = () => {
    reset();
    void router.invalidate();
  };

  return (
    <main className="relative min-h-svh bg-background px-6 py-12 text-foreground">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <header className="space-y-3 text-center">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.4em] text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            {m.error_page_eyebrow()}
          </p>
          <h1 className="text-3xl font-semibold uppercase tracking-widest sm:text-4xl">
            {m.error_page_title()}
          </h1>
          <p className="mx-auto max-w-md text-sm text-muted-foreground sm:text-base">
            {m.error_page_body()}
          </p>
        </header>

        <AppErrorView error={error} />

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button type="button" variant="outline" onClick={handleRetry}>
            <RotateCcw className="mr-2 h-4 w-4" />
            {m.common_retry()}
          </Button>
          <Button asChild>
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              {m.common_home()}
            </Link>
          </Button>
        </div>

        {DEV ? <DevDetailsPanel error={error} info={info} /> : null}
      </div>
    </main>
  );
}

function DevDetailsPanel({
  error,
  info,
}: {
  error: unknown;
  info?: { componentStack: string };
}) {
  const name = error instanceof Error ? error.name : 'Non-Error throw';
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const causes = collectCauses(error);

  return (
    <details
      open
      className="rounded-lg border-2 border-dashed border-destructive/40 bg-destructive/5 p-4"
    >
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-destructive">
        Developer details — dev build only
      </summary>

      <div className="mt-4 space-y-4 font-mono text-xs">
        <Section label="Error">
          <span className="font-semibold text-destructive">{name}</span>
          {message ? (
            <>
              : <span className="text-foreground">{message}</span>
            </>
          ) : null}
        </Section>

        {stack != null ? (
          <Section label="Stack">
            <pre className="overflow-x-auto whitespace-pre rounded-md bg-card/60 p-3 text-foreground">
              {stack}
            </pre>
          </Section>
        ) : null}

        {info?.componentStack != null ? (
          <Section label="React component stack">
            <pre className="overflow-x-auto whitespace-pre rounded-md bg-card/60 p-3 text-foreground">
              {info.componentStack}
            </pre>
          </Section>
        ) : null}

        {causes.length > 0 ? (
          <Section label={`Caused by (${causes.length})`}>
            <ol className="space-y-3">
              {causes.map((cause, i) => (
                <li key={i} className="rounded-md bg-card/60 p-3">
                  <p className="text-muted-foreground">
                    <span className="font-semibold text-destructive">{cause.name}</span>
                    {cause.message ? (
                      <>
                        : <span className="text-foreground">{cause.message}</span>
                      </>
                    ) : null}
                  </p>
                  {cause.stack != null ? (
                    <pre className="mt-2 overflow-x-auto whitespace-pre text-foreground">
                      {cause.stack}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ol>
          </Section>
        ) : null}
      </div>
    </details>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="font-sans text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <div>{children}</div>
    </div>
  );
}

type CauseFrame = { name: string; message: string; stack?: string };

function collectCauses(root: unknown): CauseFrame[] {
  const out: CauseFrame[] = [];
  const seen = new Set<unknown>();
  let current = root instanceof Error ? root.cause : undefined;
  while (current != null && !seen.has(current) && out.length < 10) {
    seen.add(current);
    if (current instanceof Error) {
      out.push({ name: current.name, message: current.message, stack: current.stack });
      current = current.cause;
    } else {
      out.push({ name: 'Non-Error cause', message: String(current) });
      break;
    }
  }
  return out;
}
