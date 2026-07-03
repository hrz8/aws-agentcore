import { Link, useRouter } from '@tanstack/react-router';
import { ArrowLeft, Home } from 'lucide-react';

import { Button } from '#/components/ui/button';
import { m } from '#/paraglide/messages.js';

export function NotFoundPage() {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.history.back();
      return;
    }
    void router.navigate({ to: '/' });
  };

  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden bg-background px-6 py-16 text-foreground">
      <div aria-hidden className="pointer-events-none absolute inset-0 select-none">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[40vw] font-bold leading-none tracking-tighter text-primary/[0.06] sm:text-[22rem]">
          404
        </div>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      <section className="relative z-10 w-full max-w-xl space-y-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">
          {m.not_found_eyebrow()}
        </p>

        <div className="space-y-3">
          <h1 className="text-3xl font-semibold uppercase tracking-widest sm:text-4xl">
            {m.not_found_title()}
          </h1>
          <p className="mx-auto max-w-md text-sm text-muted-foreground sm:text-base">
            {m.not_found_body()}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button type="button" variant="outline" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {m.not_found_back()}
          </Button>
          <Button asChild>
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              {m.common_home()}
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
