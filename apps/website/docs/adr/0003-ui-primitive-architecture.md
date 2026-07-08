# ADR 0003: UI Primitive architecture — polymorphic, prop-driven variants, single file per primitive

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-06-18 |
| **Deciders** | Hirzi |
| **Supersedes** | — |
| **Superseded by** | — |
| **Implements** | [Story #14](https://github.com/trinitywizards/aisaas-product/issues/14) under Epic [#1](https://github.com/trinitywizards/aisaas-product/issues/1) |

## Context

Story #14 ships nine UI Primitives (`Button`, `Badge`, `Tag`, `LanguageSwitcher`, `FormField`, `Card`, `SectionHeading`, `Accordion`, `ComparisonTable`) plus `AccordionItem` as Accordion's per-item child — ten files total. The Story explicitly delegates primitive implementation strategy ("single component per variant vs polymorphic with prop-driven variants") to the tech lead.

Every page Epic depends on this layer. A wrong shape here multiplies — call sites across `/`, `/use-cases`, `/developers`, `/pricing`, `/about`, `/comparison`, `/glossary`, and the booking surface all consume these primitives. The cost of an awkward variant API is paid in every PR for the next six Epics.

The codebase is Astro 6 + Tailwind v4 (see [ADR-0002](./0002-design-tokens.md)). Tailwind v4's `@theme` block emits utility classes from Design Tokens, so primitives express variants by composing Tailwind utilities, not by writing component-scoped CSS. Astro components are slot/prop-shaped, not class-instance-shaped — closer to React function components than to Web Components.

This ADR commits the shape of the primitive layer: file granularity, variant API, state surface, composition model. ADR-0004 covers the orthogonal interactivity model (zero-JS-by-default, native-HTML-first).

## Decision

One Astro component per primitive name in `apps/website/src/components/ui/`, polymorphic across variants. Ten sub-decisions follow:

1. **One file per primitive name.** `Button.astro`, `Badge.astro`, `Tag.astro`, `LanguageSwitcher.astro`, `FormField.astro`, `Card.astro`, `SectionHeading.astro`, `Accordion.astro`, `AccordionItem.astro`, `ComparisonTable.astro`. The shadcn convention `src/components/ui/` is adopted verbatim — engineers transferring in find the primitives without a tour. Page-Epic composites live under `src/components/<page-or-feature>/`; site-wide composites (Header, Footer) at `src/components/` root.

2. **Variant via a string-literal-union prop.** `<Button variant="primary" />`, `<SectionHeading visualLevel="display" />`. No `ButtonPrimary.astro` / `ButtonSecondary.astro` file split. The variant axis lives in TypeScript, not the filesystem.

3. **State via discrete boolean (or string) props.** `disabled`, `loading`, `required`, `error: string`. Never overload `variant` with state. State and variant are orthogonal axes; conflating them creates `variant: 'primary' | 'primary-loading' | 'primary-disabled' | ...` explosions that the file split would also suffer.

4. **`tone` is a separate axis where color theme is orthogonal to variant.** Badge takes `tone: 'positive' | 'pending' | 'info' | 'neutral'` + `dot: boolean`, not `variant: 'available-now' | 'coming-q4' | 'now-onboarding'`. The latter encodes content into the API; the former composes every Story-listed Badge from two orthogonal axes.

5. **Variant → class mapping via a const lookup record.** Each primitive declares `const variantClasses = { primary: '…', secondary: '…' } as const` at the top of its file, then composes via Astro's `class:list={[base, variantClasses[variant], props.class]}`. No inline string concatenation, no `clsx`/`cva` dependency, lints cleanly under the existing utility-class allowlist.

6. **Polymorphic element via meaningful prop, not `as`.** `<Button href="/foo">` renders `<a>`; `<Button>` (no href) renders `<button type="button">`. Card with `href` wraps its content in `<a>`. The caller indicates intent via the semantically loaded prop (`href` = navigation), not via a meta-prop (`as="a"`). Cleaner API, no two-component proliferation, no `LinkButton` / `ButtonLink` naming bikeshed.

7. **Named slots over props when content can be rich.** SectionHeading lede, Card body, Card footer, Card icon, Button icon-left/right — all slots. Short text (eyebrow, title, label) stays as props. Rationale: page Epics will frequently want inline links or emphasis in lede / body; converting to slot later forces a breaking API change.

8. **`class` prop passed through via `class:list`.** Every primitive accepts `class?: string` and merges it last so caller-side utilities win on collision. This is the only sanctioned escape hatch for one-off layout adjustments at the call site; per-primitive style overrides go through `variant` and `tone` props, not `class`.

9. **Tag and Badge stay distinct components.** They share an internal pill shape but encode different semantics (taxonomy vs status). A shared shell (`PillShell.astro` or a `.pill` Tailwind utility) is deferred per the Rule of Three — when a third pill-shaped primitive arrives, extract with concrete divergence patterns in hand. Premature consolidation calcifies the API around two callers that don't yet need to evolve together.

10. **`FormField` id derives from required `name` prop, not random UUID.** `const id = props.id ?? \`field-${props.name}\`` — deterministic across builds, clean PR diffs, no lighthouse snapshot noise. Two fields sharing a name on one page is already a form bug; id collision is early detection. Caller can override `id` for the multi-step-form edge case.

## Alternatives Considered

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Polymorphic with variant prop (chosen)** | One file per primitive name; state and variant axes stay orthogonal; idiomatic for Astro + Tailwind v4; showcase code stays compact | Variant lookup pattern duplicates across 10 files (no shared abstraction); structurally divergent variants (Button anchor vs button) need runtime branching | **Chosen** |
| Single-component-per-variant (`ButtonPrimary.astro`, `ButtonSecondary.astro`, ...) | Filename is the variant; no string union to type-check; each file is the smallest possible unit | 4 × 9 = ~36 files; barrel-file maintenance; state axis (loading/disabled) doesn't decompose by file — every variant file still needs the state props; showcase becomes a wall of component names | Rejected |
| `as` prop for polymorphic element (`<Button as="a" />`) | Familiar to React engineers (Chakra, MUI pattern) | Astro slots don't compose with `as` cleanly; `href` is already the natural intent signal; introduces a meta-prop concept that doesn't carry through the rest of the primitive layer | Rejected |
| `class-variance-authority` (cva) for variant composition | Battle-tested API; type-safe variant composition; widely adopted in shadcn-style codebases | One more runtime dependency for a 5-line lookup record; obscures the variant→class mapping behind a wrapper; no offsetting clarity gain at 10 primitives | Rejected |
| Shared `PillShell.astro` partial used by Tag + Badge | DRY; one place to evolve pill base shape | Two callers is below the Rule-of-Three threshold; coupling Tag's evolution to Badge's tone axis with no current divergence pressure | Rejected (revisit on third pill use) |
| `crypto.randomUUID()` for FormField id | Guaranteed unique; library-recommended pattern | Non-deterministic across builds → noisy PR diffs and CI snapshot drift; `name` is required and already collision-free in valid forms | Rejected |
| Render-prop / function-as-children pattern for variant composition | Maximum flexibility for caller | Idiom doesn't exist in Astro slots; over-engineering for the scope | Rejected |

## Consequences

### Positive

- Ten files in `src/components/ui/` cover the entire Story #14 surface. New engineers find the primitive layer by directory name without a tour.
- Variant + state axes are orthogonal and compose cleanly. Adding "loading state to all variants" is one prop addition, not a change across N variant files.
- Variant lookup records are short, lint-clean under the existing utility-class allowlist, and visually compact in code review.
- `href`-decides-element keeps the Button API single. No `LinkButton` / `ButtonLink` naming bikeshed in future PRs.
- Deterministic FormField ids → clean HTML diffs in PR review; reproducible builds.
- The showcase grid at `/internal/primitives` becomes a wall of `<Button variant="primary" />`, `<Button variant="secondary" loading />`, etc. — at-a-glance scannable.

### Negative

- Each primitive duplicates the `variantClasses` lookup pattern. No DRY abstraction. Mitigation: the pattern is short (5–8 lines per file) and each table is co-located with the primitive it serves, so divergence is intentional, not accidental.
- Structurally divergent variants (Button's anchor-vs-button) require runtime branching inside `Button.astro`. Mitigation: this is the only such case in the 10 primitives; complexity is bounded.
- Tag and Badge will diverge in implementation for a while before they converge (or not). Mitigation: Rule of Three; we revisit when a third pill primitive lands.

## Revisit triggers

Reconsider if **any** of:

- A primitive accumulates more than ~5 variant × state branches inside one file (a sign that the polymorphic shape is past its useful range — split or extract a state machine).
- A third pill-shaped primitive arrives (Tag, Badge, plus one more), justifying the shared `PillShell` extraction deferred by the Rule of Three.
- Tailwind v4 evolves a first-party variant API that makes the const-lookup pattern look hand-rolled (e.g. native `@variant` declarations addressing component-variant composition).
- The codebase adopts a UI framework with islands (see [ADR-0004](./0004-zero-js-by-default.md)); the primitive shape may need to migrate from `.astro` to that framework's component model.
