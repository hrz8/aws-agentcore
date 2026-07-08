# ADR 0005: Site-wide chrome interactivity — native `<dialog>` mobile drawer, IntersectionObserver + Scroll Sentinel sticky-blur, build-time active-route

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-06-19 |
| **Deciders** | Hirzi |
| **Supersedes** | — |
| **Superseded by** | — |
| **Implements** | [Story #15](https://github.com/trinitywizards/aisaas-product/issues/15) under Epic [#1](https://github.com/trinitywizards/aisaas-product/issues/1) |

## Context

Story #15 ships the site-wide Header + Footer that wrap every route via `Layout.astro`. Three architecturally-loaded sub-problems emerge: (1) the mobile drawer, (2) the sticky-on-scroll backdrop-blur header treatment, (3) active-route detection across locales.

[ADR-0004](./0004-zero-js-by-default.md) commits the marketing site to zero-JS-by-default, native-HTML-first interactivity. The drawer is the first interactive surface whose AC list — focus trap, Escape dismiss, overlay-click dismiss, `role="dialog"` announcement, labelled title — overflows what bare HTML offers without script. The sticky-blur transition needs a per-page anchor whose location only each page can know. The active-route detection needs a way to know which path is current without re-implementing routing or pulling in client JS.

This ADR commits the *interaction model* across all three. [ADR-0003](./0003-ui-primitive-architecture.md) covers the orthogonal question of UI Primitive shape (polymorphic, prop-driven). [ADR-0004](./0004-zero-js-by-default.md) covers the orthogonal question of zero-JS-by-default — this ADR is the first principled exception to that default and explains why.

## Decision

Three sub-decisions, each scoped narrowly.

### 1. Mobile drawer: native `<dialog>` + `showModal()`

`Header.astro` renders a `<dialog>` element for the mobile drawer. A co-located inline `<script>` of ~20 lines wires:

- Hamburger trigger → `dialog.showModal()`
- Close button / overlay click / nav-link click → `dialog.close()`
- Toggle's `aria-expanded` mirrors `dialog.open`

What `<dialog>.showModal()` provides natively, paid for in zero script:

- **Focus trap** — browser-managed since Chrome 37, Safari 15.4, Firefox 98. All shipping by 2024.
- **Escape-key dismiss**
- **`role="dialog"` + `aria-modal="true"`** announcement to assistive tech
- **`::backdrop` pseudo-element** for the scrim (styled `rgba(0,0,0,0.45)`)

What the inline script handles:

- Opening the dialog (`<dialog>` does not open from a checkbox or pure CSS)
- Closing on overlay click (`<dialog>` does not natively close from backdrop-click)
- Closing on nav-link click (defensive — the page reload that follows would also close it, but explicit close prevents stale-state edge cases like SPA-style navigation in future Epics)
- Mirroring `aria-expanded` on the hamburger trigger

The script stays well under ADR-0004's ~50-line revisit trigger. No client framework. No focus-trap library.

The drawer activates below the `lg` breakpoint (1024px). Above `lg`, the desktop horizontal nav is used and the `<dialog>` is `display: none`.

### 2. Sticky-blur detection: IntersectionObserver watching a per-page **Scroll Sentinel**

`Header.astro`'s inline `<script>` instantiates a single `IntersectionObserver`. The observed element is the first `[data-scroll-sentinel]` in the document, if present.

When the sentinel exits the viewport (visitor scrolled past), the header gains a `.scrolled` class which applies the translucent `bg-bg/82` + `backdrop-filter: blur(8px)` + drop shadow. When the sentinel returns to viewport (scrolled back), the class is removed.

Pages with a hero render the sentinel at the bottom edge of the hero block:

```astro
<section class="min-h-dvh">
  …hero content…
  <div data-scroll-sentinel></div>
</section>
```

**Pages with no sentinel** render the header in the unscrolled state forever — acceptable for long content pages (`/glossary`, `/comparison`) where the chrome's role is consistent throughout. The decision for those pages can be revisited when their page Epic lands.

`prefers-reduced-motion` is honored by the global CSS reset (ADR-0002 §A); the class swap snap-transitions for users who opted in.

### 3. Active-route detection: build-time via `Astro.url.pathname`

Astro's `output: 'static'` means each route is prebuilt with a known `Astro.url.pathname`. `Header.astro` consumes this value at build time to compute `aria-current="page"` on the matching nav link.

Match logic — locale-stripped prefix-match, with `/` as the exact-match special case:

```ts
function isActive(linkHref: string, currentPathname: string): boolean {
  const normalized = stripLocale(currentPathname);
  if (linkHref === '/') return normalized === '/';
  return normalized === linkHref || normalized.startsWith(linkHref + '/');
}
```

`stripLocale()`, `localeHref()`, and `isEnOnlyPath()` live in a new `apps/website/src/lib/i18n.ts` — the canonical home for cross-component locale-routing logic. Header, Footer, and `LanguageSwitcher` all consume it.

No client-side script for active-state. No `<noscript>` fallback needed. Zero hydration cost.

## Alternatives Considered

### For decision 1 (mobile drawer)

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Native `<dialog>` + `showModal()` (chosen)** | Browser-native focus trap, Escape dismiss, `role="dialog"` for free; ~20 lines of inline script; no framework dependency | Requires JS to open (CSS-only fallback impossible); minor `<dialog>` quirks (backdrop-click is not native, needs a handler) | **Chosen** |
| CSS-only `<input type="checkbox">` peer-selector hack | Works without JS; `:checked` is real DOM state | **Cannot trap focus.** Cannot listen for Escape. `aria-expanded` mirror requires JS anyway; "overlay click dismiss" requires a `<label>` covering the scrim, awkward markup; fails the focus-trap and Escape AC outright | Rejected |
| React/Solid client island via `@astrojs/react` | Mature focus-trap libraries; familiar component model | Pulls a framework dependency into the Foundation Epic; not a revisit trigger per ADR-0004 (one modal flow, not "multi-primitive client state spanning a feature") | Rejected — ADR-0004 explicitly rejected this without a triggering condition |
| Inline custom focus-trap implementation in vanilla JS | Total control, no framework | Re-implements what `<dialog>.showModal()` does natively; script grows past ADR-0004's 50-line ceiling almost immediately | Rejected — duplicating browser-native behavior |

### For decision 2 (sticky-blur detection)

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **IntersectionObserver + Scroll Sentinel (chosen)** | Single event per crossing; no scroll-event thrash; per-page anchor (each page Epic decides where "scrolled past hero" means) | Per-page convention to maintain — pages must render the sentinel; new term ("Scroll Sentinel") for the glossary | **Chosen** |
| `scroll` event listener + `scrollY > N` threshold | Trivial to implement | Fires constantly during scroll; needs a magic-number threshold per breakpoint; no per-page customisation | Rejected — wasteful + brittle |
| CSS `position: sticky` + `:stuck` pseudo-class | Pure CSS, no script | `:stuck` not yet shipped cross-browser as of 2026; spec is still in draft | Rejected — not viable for v1 |
| Layout prop (`heroHeight`) passed from each page | Explicit declaration per page | Tight coupling between Layout API and page shape; awkward for pages without hero or with multiple "above the fold" sections | Rejected — sentinel element is a cleaner contract |

### For decision 3 (active-route detection)

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Build-time via `Astro.url.pathname` (chosen)** | Zero JS; correct on first paint; deterministic across CI snapshots; works in `<noscript>` | None for a static site | **Chosen** |
| Client-side via `window.location.pathname` in inline script | Decouples chrome from page | Flash of unstyled active-state; no benefit for a static site | Rejected |
| Both (SSG + client override) | Belt-and-braces | Pure overkill | Rejected |

## Consequences

### Positive

- Mobile drawer ships every Story #15 a11y AC at zero framework cost. Focus trap, Escape dismiss, `role="dialog"` announcement are all browser-native via `<dialog>.showModal()`.
- Inline drawer script stays under ADR-0004's 50-line ceiling.
- Sticky-blur is per-page customisable via the **Scroll Sentinel** convention. Each page Epic decides where the transition fires by placing the sentinel — no Layout-prop coupling.
- Active-route detection adds zero script weight. Lighthouse FCP/TBT stay clean.
- New `src/lib/i18n.ts` helper centralises locale-routing logic for Header, Footer, LanguageSwitcher, and future page Epics — single place to evolve if the locale list grows.

### Negative

- **JS-disabled mobile drawer is non-functional.** The hamburger toggle does nothing without JS. Mitigation: the Footer renders the same nav and is always visible (no JS required); the audience overlap with "browses a marketing site with JS disabled on mobile" is small. Accepted.
- **Scroll Sentinel is a convention, not a constraint.** Page Epics must remember to render `<div data-scroll-sentinel></div>` at their hero's bottom edge. Forgetting yields a never-scrolled header (the chrome doesn't break, just looks visually identical at all scroll positions). Mitigation: documented in `apps/website/CONTEXT.md` and surfaced in the `/internal/chrome` Showcase Surface.
- **`<dialog>` browser quirks.** Backdrop-click dismissal is not native and needs a click-handler. Some older Safari versions render the backdrop without an explicit `dialog[open]::backdrop` selector. Manageable; documented inline in `Header.astro`.

## Revisit triggers

Reconsider if **any** of:

- The drawer's inline script exceeds ~50 lines (the ADR-0004 ceiling), e.g. because a future feature adds per-link nested submenus or multi-step navigation. At that point, evaluate a small focus-management helper in `src/lib/` or a client island for just the drawer.
- A page Epic needs multiple "scroll phases" (e.g. header is transparent in hero, blurred in mid-section, solid above footer). The single-sentinel model breaks down; consider a section-anchored Observer per phase, or refactor to a `data-scroll-state="…"` enumerated attribute model.
- The codebase adopts a JS framework for any reason (per ADR-0004's same trigger). Decision 1 may shift to a framework component for the drawer.
- The site needs SSR or pre-rendered-per-request behaviour (e.g. for A/B test gates on first paint). Decision 3's "build-time pathname" model would need to extend to runtime evaluation; the helper interface stays the same.
- A third caller for the locale routing helpers appears outside Header/Footer/LanguageSwitcher (e.g. a page-Epic-specific component computing a locale-mirrored URL), at which point the helper API surface may benefit from a richer ergonomics pass.
