# Engineering Context — TWAI Marketing Site

## What this codebase does

`nd8.ai` — the standalone marketing site for the TWAI product. Static Astro build, deployed via CDK to S3 + CloudFront under per-Stage AWS accounts (`Dev`, `Prod`). Distinct from the platform runtime: different domain, different audience, different infra. Code under `apps/website/`.

## Top-level architecture

- **Astro** static-site generator (v6). Tailwind v4 via `@tailwindcss/vite`. Pages under `src/pages/`, layouts under `src/layouts/`, shared styles in `src/styles/global.css`.
- **i18n** via Astro's built-in routing — default `en-GB`, secondary `ms` (Bahasa Melayu). Fallback `ms → en-GB` via rewrite.
- **Deploy**: `pnpm build` → `dist/` → CDK uploads to S3 → CloudFront serves. One CloudFront distribution per Stage. See [ADR-0001](./docs/adr/0001-preview-strategy.md) for why there are no per-PR ephemeral previews.
- **Design tokens** in a single `@theme` block in `global.css`. Tokens come from the locked Figma frame `29:5768`. See [ADR-0002](./docs/adr/0002-design-tokens.md).

## Boundaries

- Separate from the **platform runtime** (Umbrella container, Console, Postgres, etc.) — those are documented in the root [CONTEXT.md](../../CONTEXT.md). This codebase is a static marketing surface only; no shared database, no shared infra primitives, no shared deploy pipeline.
- Marketing **copy and product vocabulary** can diverge from platform engineering vocabulary. The platform glossary defines `Tenant`, `Member`, `End User`; marketing copy speaks to "your customers", "your team", "your stack". Do NOT enforce platform terminology in marketing copy — different audience, different register.

## Language

The marketing-site glossary covers terms that have a specific meaning in this codebase. For platform terms (`Tenant`, `Agent`, `Invocation`, etc.) see the root [CONTEXT.md](../../CONTEXT.md).

### Design tokens & visual identity

**Design Token**:
A named CSS custom property declared in the `@theme` block of `apps/website/src/styles/global.css`. Tokens are the only sanctioned way to reference brand values in code — raw hex, `px`, or `rem` literals for color, font-size, spacing, or radius are stylelint errors. The source of truth is Figma node `29:5768`. See [ADR-0002](./docs/adr/0002-design-tokens.md).
_Avoid_: Variable (too generic), constant (suggests JS), theme value (collides with white-label).

**Brand Value**:
The atomic visual unit referenced by a Design Token: one color, one type style, one spacing step, one radius, the gradient, the glow. Story #13 ships every Brand Value needed by the rest of the marketing site Epic. UI Primitives (`Button`, `Card`, etc.) compose from Brand Values via Design Tokens — they ship in Story #14, out of #13's scope.
_Avoid_: Token (Design Token is the implementation; Brand Value is the design concept), Atom (Atomic Design jargon), Primitive (reserved for UI Primitive — the Story #14 component layer).

**UI Primitive**:
A shared, reusable component composed from Brand Values via Design Tokens — the nine Story #14 deliverables: `Button`, `Badge`, `Tag`, `LanguageSwitcher`, `FormField`, `Card`, `SectionHeading`, `Accordion`, `ComparisonTable`. Page Epics compose pages from these, not from raw Design Tokens. Lives in `apps/website/src/components/ui/`; page-Epic composites live under `apps/website/src/components/<page-or-feature>/`; site-wide composites (`Header`, `Footer`) live at `apps/website/src/components/` root.
_Avoid_: Component (too generic — the codebase has many components; only the shared atomic layer counts as UI Primitives), Atom (Atomic Design jargon).

**Type Scale**:
The 7-step progression `Display → H1 → H2 → H3 → Body L → Body → Caption`. Display and H1 are fluid (`clamp()` between min and max viewport sizes); H2 through Caption are fixed. Exposed both as base-layer auto-styles on raw `<h1>`/`<h2>`/`<p>` and as utility classes (`text-display`, `text-h1`, etc.) for cases where semantic level differs from visual level.

**Spacing Step**:
One of seven canonical spacings — `8 / 12 / 18 / 24 / 32 / 56 / 80px` — named `--spacing-1` through `--spacing-7`. These OVERRIDE Tailwind's default 4-multiple spacing scale: `p-1` in this codebase means 8px, NOT 4px. Engineers with Tailwind muscle memory should expect the difference. See [ADR-0002](./docs/adr/0002-design-tokens.md).
_Avoid_: Margin/padding step (mixes concept with usage), `--space-*` (collides with Tailwind's `space-x-N` flex utility namespace).

**Showcase Surface**:
A dev/preview-only Astro page under `/internal/*` that renders implementation against the Figma source at a glance, for designer / reviewer / engineer verification. Three pages today: `/internal/design-tokens` (every Design Token with name + visual sample + WCAG badges), `/internal/primitives` (every UI Primitive in every variant × state × breakpoint), and `/internal/chrome` (Header + Footer in every state: unscrolled / scrolled+blur / drawer-open / on-light / on-dark / EN-only caption). An `/internal/index.astro` lists all of them. All Showcase Surfaces share one build-flag gate, `INCLUDE_DESIGN_TOKENS=1` — present in dev + Pages preview builds, absent in the production nd8.ai build. (The env-var name predates the additional pages and stays for CI/config continuity.)
_Avoid_: Design system page (no longer premature, but too broad — Showcase Surface is the artifact, not the system), style guide (too broad), demo page (confused with marketing demos).

**Contrast Matrix**:
The WCAG 2.2 AA verification table covering every documented foreground/background Design Token pair. Produced two ways from one source: live PASS/FAIL badges in the Showcase Surface, plus a generated `apps/website/docs/contrast-matrix.md` committed to the repo and linked from each tokens-touching PR.

**Token Override**:
The Tailwind v4 mechanism for replacing a default theme value. The `@theme` block in `global.css` overrides Tailwind's defaults (e.g. `--spacing-*` → our 7-step scale; default `--color-slate-*` palette → unused, kept available but discouraged via lint). Distinct from a runtime override (a designer remapping `--accent` for white-label) — that uses standard CSS variable cascade, not `@theme`.

### Site chrome & interactivity

**Site Chrome**:
The Header and Footer rendered by `Layout.astro` around every route's `<slot />`. Implemented as `apps/website/src/components/Header.astro` and `Footer.astro` (site-wide composites — see UI Primitive). Layout exposes a `chrome?: boolean = true` prop; Showcase Surfaces at `/internal/*` opt out via `chrome={false}`. The skip-link + `<main id="main">` wrapper live in Layout regardless of `chrome`. See [ADR-0005](./docs/adr/0005-chrome-interactivity.md).
_Avoid_: Shell (collides with terminal/web-component shell vocabulary), Frame (collides with Figma frames).

**Scroll Sentinel**:
A `<div data-scroll-sentinel></div>` element rendered by a page at the bottom edge of its hero block. Header watches the first matching element via `IntersectionObserver`; when the sentinel exits the viewport, the header transitions to its scrolled state (translucent background + backdrop-blur + drop shadow). Pages with no sentinel render the header in the unscrolled state forever — acceptable for long content pages without an above-the-fold visual ambiguity. See [ADR-0005](./docs/adr/0005-chrome-interactivity.md) §2.
_Avoid_: Scroll trigger (too generic — could be any scroll-driven effect), hero anchor (overloads "anchor" which already means link target).

**Locale Helper**:
The `apps/website/src/lib/i18n.ts` module exporting the canonical locale-routing functions: `localeHref(path, locale)` for building locale-prefixed hrefs, `stripLocale(path)` for canonicalising a path back to its locale-free form, and `isEnOnlyPath(path)` for the per-IA list of pages that ship English only (`/developers`, `/comparison`, `/glossary` per Design Brief §IA). Header, Footer, LanguageSwitcher, and future page Epics consume it — single home for cross-component routing logic.
_Avoid_: i18n util (too generic), routing helper (collides with Astro's own routing).

### Stages & deploys

**Stage**:
An AWS account namespace — `Dev` or `Prod` — owning a single CloudFront distribution + S3 bucket pair for the marketing site. PRs do not deploy; the shared `Dev` Stage URL is the preview surface. See [ADR-0001](./docs/adr/0001-preview-strategy.md).
