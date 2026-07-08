# ADR Format

ADRs (Architecture Decision Records) live in `docs/adr/` with sequential numbering: `0001-slug.md`, `0002-slug.md`, etc.

## Template

```md
# ADR NNNN: {Short title of the decision}

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | YYYY-MM-DD |
| **Deciders** | <Name(s)> |
| **Supersedes** | — |
| **Superseded by** | — |

## Context

<2-3 sentences. What problem are we solving, what constraints apply.>

## Decision

<1-2 sentences. The actual decision.>

## Alternatives Considered

| Option | Pros | Cons | Verdict |
|---|---|---|---|

## Consequences

### Positive
- ...

### Negative
- ...
```

## Numbering

Scan `docs/adr/` for the highest existing number and increment by one.

## When to offer an ADR

All three must be true:

1. **Hard to reverse** — meaningful cost to change your mind later
2. **Surprising without context** — a future reader will wonder why
3. **The result of a real trade-off** — genuine alternatives existed

If any is missing, skip the ADR.

### What qualifies

- **Framework / language / runtime choice.** "Why TanStack Start over Next.js."
- **Persistence choice for a new concept.** "Why event-sourced for orders, not table-based."
- **Cross-cutting libraries.** "Why zod over yup for validation."
- **Deliberate deviations from common patterns.** "Why we keep this synchronous despite the obvious async option."
- **Constraints not visible in code.** "Why we cap queue depth at N due to upstream rate limit."

### What does NOT qualify

- Minor refactors with no design trade-off.
- Following obvious convention with no alternatives considered.
- Decisions captured well enough in code comments or the affected module's README.

## Relationship to RFCs

ADRs document *individual* decisions. When several related decisions emerge together (e.g., introducing a new subsystem), prefer an **RFC** (`to-rfc` skill) — the RFC frames the proposal, and ADRs spawned from the RFC capture the individual decisions made along the way.
