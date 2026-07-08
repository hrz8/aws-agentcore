# website

Marketing site for **nd8.ai** — static Astro build. Separate from the runtime: own domain, own infra.

## Stack

- Astro 7 (SSG) + MDX
- Tailwind v4 via `@tailwindcss/vite`
- i18n: `en-GB` (default) + `ms` (fallback → en-GB)
- Design tokens in `src/styles/global.css` — see [`CONTEXT.md`](./CONTEXT.md)

Node **24**, pnpm **10**.

## Scripts

```bash
pnpm --filter website dev          # http://localhost:4321
pnpm --filter website build        # → dist/
pnpm --filter website preview      # serve dist/
pnpm --filter website typecheck    # astro check
pnpm --filter website lint         # stylelint + utility-class lint (both run; no short-circuit)
```

## Env

Only one build-shape flag; no secrets:

```env
# apps/website/.env.development
INCLUDE_DESIGN_TOKENS=1            # exposes /internal/design-tokens; leave UNSET in prod (astro.config.mjs prunes dist/internal/)
```

## Layout

```
src/
├── pages/           # index.astro, 404.astro, ms/, internal/ (dev-only)
├── layouts/         # Layout.astro
├── components/      # Header, Footer + ui/ (Story #14 primitives)
├── styles/global.css   # design tokens in a single @theme block
├── lib/             # i18n, contrast helpers
└── assets/          # logos
scripts/             # lint passes + contrast-matrix generator
```

## Deploy

```bash
./scripts/website-push.sh [Dev|Prod]   # astro build + s3 sync + CloudFront invalidation
```

Reads bucket/distribution IDs from the CDK stack outputs. No CDK redeploy for content-only changes. Per-Stage CloudFront distribution; no per-PR previews.
