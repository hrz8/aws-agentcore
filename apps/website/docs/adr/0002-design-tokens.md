# ADR 0002: Design tokens — single `@theme` source, Figma-locked, lint-enforced

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-06-16 |
| **Deciders** | Hirzi |
| **Supersedes** | — |
| **Superseded by** | — |
| **Implements** | [Story #13](https://github.com/trinitywizards/aisaas-product/issues/13) under Epic [#1](https://github.com/trinitywizards/aisaas-product/issues/1); [PDR-0002 visual identity](https://github.com/trinitywizards/aisaas-product/blob/main/docs/decisions/0002-twai-visual-identity.md) |

## Context

Story #13 requires every Brand Value — color, spacing, radii, gradient, glow, typography — to be implemented once and referenceable across the codebase from a single source. The locked source of truth is Figma node `29:5768` (the "Design tokens" reference frame). The Story explicitly delegates three calls to the tech lead: token implementation strategy, font-hosting strategy, and preload/`font-display` choice.

The codebase uses Astro 6 + Tailwind v4 (via `@tailwindcss/vite`). Tailwind v4 unifies the historical split between "CSS custom properties" and "Tailwind theme config" into a single `@theme` block that emits both CSS variables AND utility classes — this changes the shape of the answer compared to Tailwind v3 / pre-v4 guidance in PRD §6.

## Decision

A single `@theme` block in `apps/website/src/styles/global.css` is the canonical source for every design token. It generates CSS custom properties AND Tailwind utility classes from one declaration. Eight sub-decisions follow:

1. **Token naming follows the Figma frame.** `--accent`, `--accent-deep`, `--gradient-to`, `--bg`, `--bg-alt`, `--surface`, `--border`, `--ink-heading`, `--ink-body`, `--ink-muted` — verbatim from node `29:5768`. Radii: `--radius-btn` (8px), `--radius-card` (14px), `--radius-pill` (999px). Type scale: `--text-display`, `--text-h1` ... `--text-caption`. Gradient: `--gradient-accent: linear-gradient(120deg, #FFB900, #FF7A4D)`. Glow: `--glow-amber: radial-gradient(circle 100px at 50% 50%, rgba(255,185,0,0.4) 0%, rgba(255,185,0,0) 70%)`.

2. **Display and H1 are fluid via `clamp()`.** Figma defines Display as `52–66px` and H1 as `42–46px` — ranges, not single values. Implementation: `--text-display: clamp(52px, calc(52px + (66 - 52) * (100vw - 640px) / (1280 - 640)), 66px)` and analogous for H1. Single token, scales smoothly between mobile (640px) and desktop (1280px) viewports, zero CLS.

3. **Spacing scale overrides Tailwind defaults.** Figma's scale is `8 / 12 / 18 / 24 / 32 / 56 / 80px` — the 18px breaks Tailwind's default 4-multiple. We declare `--spacing-1: 8px` ... `--spacing-7: 80px` in `@theme`, which physically replaces Tailwind's default. `p-1` in this codebase means 8px, NOT 4px. Engineers must be told (this ADR + `CONTEXT.md`); the showcase + a one-line comment in `global.css` flag the deviation at the source.

4. **Type scale API: base-layer auto-styling + utility overrides.** Raw `<h1>` / `<h2>` / `<p>` get the appropriate style via a Tailwind `@layer base` block. Engineers writing semantic HTML get correct typography by default. Utility classes (`text-display`, `text-h1` ... `text-caption`) exist for cases where the visual level differs from the semantic level (e.g. an `<h2>` styled with Display because hierarchically it's a section title but visually it's a hero).

5. **Font hosting: Astro's native fonts integration.** Configured in `astro.config.mjs` with families Sora and Syne, weights 400 (Sora) and 600 (Syne), subsets `['latin', 'latin-ext']` (covers EN + Bahasa Melayu). Astro downloads fonts at build time, self-hosts them, generates `@font-face` rules, and provides metric-matched fallbacks automatically. No third-party CDN load.

6. **FOUT prevention: `font-display: swap` + `<link rel=preload>` + metric-matched fallbacks.** The `<head>` in `Layout.astro` preloads Sora 400 and Syne 600 `.woff2` files. `font-display: swap` ensures text is never invisible. Astro's fonts integration emits `size-adjust`, `ascent-override`, `descent-override` on a `system-ui` fallback so the fallback occupies the same line metrics as the brand fonts — zero CLS when the brand font arrives.

7. **Build-time enforcement via stylelint.** Raw `#rrggbb` color literals, raw `px` values in `font-size` / `margin` / `padding` / `border-radius`, and use of Tailwind spacing utilities outside the design-scale allowlist (`p-1, p-2, p-3, p-4, p-5, p-6, p-7` and their `m-` / `gap-` / `space-` siblings) all fail lint. Wired into the existing `pnpm lint` script. The Story's "misspelled reference fails the build" criterion is enforced here — Tailwind v4 alone silently no-ops on unknown utilities.

8. **Showcase surface: `/internal/design-tokens`, dev/preview-only.** A single Astro page renders every token with its name + visual sample, plus live WCAG 2.2 AA PASS/FAIL contrast badges (TS function computing ratios from the token values). Build flag `INCLUDE_DESIGN_TOKENS=1` controls inclusion — set in dev + Cloudflare Pages preview builds, unset in the production nd8.ai build. A `pnpm contrast-matrix` script writes `apps/website/docs/contrast-matrix.md` from the same TS source for PR review.

A global `@media (prefers-reduced-motion: reduce)` reset in `global.css` zeroes all transitions and animations universally; any future token-based motion respects user preference by default.

## Alternatives Considered

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Single `@theme` block (chosen)** | One source generates both CSS vars and utilities; no duplication; idiomatic Tailwind v4 | Locks us to Tailwind v4's emerging conventions | **Chosen** |
| Separate `:root { --accent: ...; }` + Tailwind `@theme` that aliases | Decouples raw CSS API from utility names | Two-layer naming (`--accent` vs `--color-accent`) creates drift surface and ergonomic friction | Rejected |
| Tokens in a TS module + Tailwind plugin + CSS-in-JS | Maximum flexibility | Astro is static; CSS-in-JS adds runtime cost and complexity for no benefit | Rejected |
| **Keep Tailwind default spacing + extend with `4.5` for 18px** | Preserves Tailwind muscle memory | Engineers can still use `p-5` (20px) which isn't on the design scale; lint allowlist still required; `p-4.5` is ugly | Rejected |
| Semantic spacing names (`--space-xs`, `--space-md`, ...) | Reads as design intent | Editorial layer — someone has to maintain xs↔px mapping; drift risk; conflicts with Tailwind's `space-x-N` utility namespace | Rejected |
| **`@fontsource/sora` + `@fontsource/syne`** | Battle-tested, what PRD §6 implied | More manual `@font-face` + preload wiring; we'd duplicate what Astro fonts provides natively | Rejected |
| Raw `.woff2` + hand-written `@font-face` | Smallest possible bytes via custom subsetting | High boilerplate; subset audit becomes ongoing maintenance | Rejected |
| `font-display: optional` (no swap, ever) | Eliminates the swap entirely | Slow connections never see brand fonts — bad for a brand-identity-critical surface | Rejected |
| **Showcase deployed in production (noindex)** | Designers can review against prod; Lighthouse runs on real URL | The token values are already public via the rendered site; minor leak of brand internals, but reveals the dev surface URL | Rejected — team preferred no surface area in prod build |
| **Showcase as separate `apps/website-showcase/` mini-site** | Strongest isolation | Second deploy pipeline + monorepo workspace for one page | Rejected — overkill |
| **Hand-written `contrast-matrix.md`** | Zero tooling cost | Goes stale instantly when any token changes; need to do the math twice (matrix + showcase badges) | Rejected |
| **Axe-core / Lighthouse report instead of matrix** | Standardized tool | Reports only on actually-rendered combos, not the full token cross-product; Story requires full matrix | Rejected — supplement, not replacement |

## Consequences

### Positive

- One file (`global.css`) owns every brand value. Future white-label reuse becomes a token swap — override `--accent` and the cascade does the rest.
- The Showcase Surface is the canonical artifact for design review. Designers and engineers reference the same surface, eliminating "what does the spec actually say" discussions.
- Stylelint catches drift at PR time, not production. The "misspelled reference fails the build" AC is enforceable, not aspirational.
- Type scale is semantic-first: `<h1>` styled correctly without a class. Pages stay accessible by default.
- Astro's native fonts integration removes manual `@font-face` and metric-override boilerplate. Less code, less drift potential.
- The contrast matrix and badges share one TS function — impossible for the committed `.md` to disagree with the showcase.

### Negative

- `p-1` means 8px (not 4px). Anyone arriving with Tailwind muscle memory will be briefly confused. Mitigation: `CONTEXT.md` glossary, this ADR, and a one-line comment in `global.css`.
- Stylelint configuration becomes a small ongoing maintenance surface — every new token needs the allowlist updated.
- The Astro fonts integration is relatively new (stable in v5+; v6 is its second major release). If it produces an edge-case bug we'll be earlier in the issue queue than `@fontsource` would be.
- Cloudflare Pages preview builds need `INCLUDE_DESIGN_TOKENS=1` set in CI env. Forgetting this means designers click the preview URL and hit 404 — caught by smoke checks but a real foot-gun.
- Lighthouse on the showcase runs against a preview deploy, not prod. Acceptable — the showcase IS the test surface — but means PRs need a preview URL before the Lighthouse AC can be verified.

## Revisit triggers

Reconsider if **any** of:

- A second product (e.g. TW marketing site) wants to reuse these tokens. The `@theme` block isn't packageable today; we'd need to extract to a shared workspace.
- UI Primitives (`Button`, `Card`, etc.) land via Story #14 — that's the moment to evaluate whether the Showcase Surface grows into a primitives gallery or stays tokens-only.
- The Astro fonts integration hits a wall we can't work around — fall back to `@fontsource-variable/*`.
- White-label tenant-specific theming becomes a real requirement (today it's hypothetical). Token cascade via `[data-tenant]` selectors is the natural next step but may need restructuring.
