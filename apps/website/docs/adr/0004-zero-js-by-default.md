# ADR 0004: Zero-JS-by-default interactivity — native HTML primitives + minimal inline scripts

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-06-18 |
| **Deciders** | Hirzi |
| **Supersedes** | — |
| **Superseded by** | — |
| **Implements** | [Story #14](https://github.com/trinitywizards/aisaas-product/issues/14) under Epic [#1](https://github.com/trinitywizards/aisaas-product/issues/1) |

## Context

Story #14 ships four UI Primitives that require interactivity:

- **Button** — loading state must be announced to assistive tech (busy) and must prevent double-submit (Story AC §Failure modes).
- **Accordion** — single-open expand/collapse with smooth motion respecting `prefers-reduced-motion` (Story AC §Happy path).
- **FormField** — error state must be announced to assistive tech the moment validation fires (Story AC §Failure modes).
- **LanguageSwitcher** — active locale state, with switching wired up in Epic 10.

Plus three behaviours touching every Story #14 primitive: focus-visible styling, disabled state enforcement, keyboard navigation.

The site is Astro static (see [`apps/website/CONTEXT.md`](../../CONTEXT.md)). Astro supports client islands (React, Solid, Preact, Vue, Svelte) via `client:*` directives, but introducing any of those for this Story would mean: pulling a framework dependency, configuring a renderer integration, accepting hydration overhead for the touched primitives, and committing to that framework's component-library conventions which differ from Astro's slot/prop shape. The marketing site has shipped zero such dependencies to date.

Native HTML covers more of the interactivity surface than the reflex reach for a framework would suggest. `<details>/<summary>` is `aria-expanded` for free. `<button>` is keyboard-activatable for free. `<select>` is mobile-native. `<input>` validity events drive accessible error announcement when paired with a live region. This ADR commits to that being the default, not the exception.

ADR-0003 covers the orthogonal question of primitive *shape* (polymorphic, prop-driven). This ADR covers *behaviour*.

## Decision

**Native HTML elements first for every interactive UI Primitive. Inline Astro `<script>` blocks only where native semantics are insufficient. No client framework, no islands.** Five sub-decisions follow:

1. **Native element backing per primitive.**
    - `Button` → `<button type="…">` (default) or `<a href>` (when `href` prop present).
    - `Accordion` → `<details>/<summary>` (free `aria-expanded`, free keyboard activation, free screen-reader semantics).
    - `FormField` → native `<input>` / `<select>` / `<textarea>` keyed off the `type` prop. The "dropdown" type maps to `<select>`, not a custom widget.
    - `LanguageSwitcher` → list of `<a>` anchors; the active locale gets `aria-current="true"`.
    - `Tag`, `Badge` → `<span>` (or `<a>` if Tag's `href` prop is set).
    - `SectionHeading` → `<h1>`/`<h2>`/`<h3>` chosen by `level` prop.
    - `ComparisonTable` → `<table>` with `<caption>`, `<thead>`, `<th scope="col" | scope="row">`.

2. **Co-located inline `<script>` blocks where native isn't enough.** Astro's component-level `<script>` is a module by default, scoped at the page level, and tree-shaken when the component isn't used. Two primitives need one:
    - **`Accordion.astro`**: a single `toggle`-event listener on child `<details>` elements that closes siblings when one opens (the `singleOpen` enforcement). The DOM API is `details.addEventListener('toggle', ...)`. Under ~20 lines.
    - **`Button.astro`**: when `loading={true}`, the rendered button has `disabled` and `aria-busy="true"` plus a visual spinner. No script needed if the loading prop is set server-side. For form-submit cases where loading toggles client-side, the page that owns the form is responsible for flipping the attribute (Story #14 ships the visual contract; per-page form scripts live in their Epic).

3. **Live regions, not scripts, for error announcement.** `FormField.astro` always renders an empty `<span id="${id}-error" role="alert" aria-live="polite">` so the live region exists in the DOM before any error text. When the `error` prop populates content, the browser announces it natively. No JS in the primitive itself; error population is the caller's responsibility (e.g. a page-level form-validation script).

4. **CSS-only motion where the platform allows it; jump-cut graceful fallback otherwise.** Accordion expand/collapse uses `interpolate-size: allow-keywords` + `transition: height 0.2s ease` — Chrome 129+, Safari 18+, Firefox 137+ as of 2026, broad support. Older browsers see an instant jump, which is acceptable: the AC requires "smooth expand/collapse" on the happy path and a jump for `prefers-reduced-motion`; treating "no platform support" the same as "user opted out" is a clean fallback. No JS-driven height measurement, no GSAP, no Web Animations API.

5. **`prefers-reduced-motion` already covered by the global CSS reset in `global.css`** (introduced by [ADR-0002 §A](./0002-design-tokens.md)). New token-level motion inherits the reset automatically. JS-driven animation (none required by Story #14) would need to check `window.matchMedia('(prefers-reduced-motion: reduce)')` per the warning already documented in `global.css`.

## Alternatives Considered

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Native HTML + inline `<script>` (chosen)** | Zero runtime JS bundle for primitives; native a11y; no hydration; no framework dependency; co-located behaviour stays scoped to the file that needs it | Inline scripts must be kept tiny; complex client-side state later forces an ADR amendment | **Chosen** |
| React / Preact client islands via `@astrojs/react` | Familiar component model; access to React-ecosystem patterns for Combobox, focus-trap, etc. | Hydration overhead per island; bundler dependency; convention split (Astro slots vs React children); only 2 primitives actually need behaviour | Rejected |
| Solid islands via `@astrojs/solid-js` | Lighter than React; signals-style reactivity | Same convention-split cost as React; current need doesn't justify a second component-model dialect | Rejected |
| Alpine.js | One-line declarative bindings; no compile step | One more dependency runtime-loaded on every page that uses any interactive primitive; declarative attributes mix concerns into the markup; gain is small at this scope | Rejected |
| HTMX | Server-driven interactivity is elegant | Doesn't apply — the marketing site is statically generated; there is no server to drive responses | Rejected |
| Custom Web Components | Native browser primitive; encapsulated; framework-free | Over-engineering for ~4 interactivity points; lifecycle boilerplate per element; Astro slots ↔ shadow-DOM slot mapping is not a free conversion | Rejected |
| Single shared JS file in `src/scripts/` | Centralised behaviour; one place to read everything | Loses Astro's per-component script scoping; loaded even on pages where the relevant primitive isn't used; couples unrelated primitives' behaviour into one bundle | Rejected (extract to `src/lib/` only when a real second caller appears) |
| JS-driven Accordion height animation (instead of `interpolate-size`) | Works on every browser including pre-2024 versions | Reading `scrollHeight` + animating manually = layout thrash, more script per primitive, more breakage surface; older browsers degrading to instant jump is fine | Rejected |

## Consequences

### Positive

- Zero runtime JS bundle from the primitive layer beyond what each component co-locates (`Accordion.astro` ~20 lines, others zero). Lighthouse stays clean by construction.
- Native HTML semantics carry the bulk of the Story #14 a11y AC at no implementation cost: `aria-expanded` on `<details>/<summary>`, keyboard activation on `<button>`, mobile-native rendering of `<select>`, table semantics for screen reader row/column navigation.
- No hydration boundary. No mental-model split between "static parts" and "island parts". One mental model: server-rendered HTML with sparing inline behaviour.
- No framework-version churn for Story #14. The platform-native APIs in use here (`details.toggle`, `aria-live`, `interpolate-size`) are standards, not vendor APIs.

### Negative

- Complex client-side state in future Epics (e.g. a multi-step waitlist form with cross-field validation, a search-and-filter grid on `/use-cases`, a live chat preview on the homepage hero) may not fit the inline-script ceiling. ADR-0004 will get amended or superseded when that pressure arrives.
- `interpolate-size: allow-keywords` is recent enough that some engineers will reach for the JS-animation reflex. Documented here so the next code review can point at the ADR instead of re-litigating.
- Inline `<script>` blocks per component can feel scattered to engineers used to a `src/scripts/` central hub. Mitigation: the script is co-located with the component it serves, so it travels in PR review with the primitive it modifies.
- Loss of optionality: if a designer later wants a sophisticated motion design that needs the Web Animations API or a library like Motion One, this ADR forces a re-evaluation rather than a quiet library install.

## Revisit triggers

Reconsider if **any** of:

- A single primitive's inline `<script>` block exceeds ~50 lines — a sign the inline-script approach is past its useful range; refactor to a `src/lib/` helper or evaluate islands for that primitive.
- A page Epic ships a feature requiring client-side state spanning multiple primitives (multi-step form, search/filter, modal-driven flow). At that point, evaluate whether to add a client island for just that feature or commit to a framework across the primitive layer.
- Accumulated co-located inline scripts push TBT (Total Blocking Time) or page weight past the Lighthouse performance budget. Consolidate into a single deferred script before adding a framework.
- The team adopts a JS framework for any reason — at which point the question is whether to migrate the primitive layer to that framework's component model (worth re-running [ADR-0003](./0003-ui-primitive-architecture.md) too) or keep the primitive layer Astro-native and use islands only for the feature that pulled the framework in.
