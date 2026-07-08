---
name: grill-with-context
description: Grilling session that challenges an engineering plan against the existing domain model and ADRs. Sharpens terminology and updates CONTEXT.md and ADRs inline as decisions crystallise. Use when an engineer picks up a Story / RFC draft / technical question and wants to stress-test it against the codebase's documented decisions before writing code. Refuses Epic and PRD inputs — those are the wrong altitude for engineering grilling.
---

<what-to-do>

Interview the user relentlessly about every aspect of this plan until you reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask one question at a time. Wait for feedback before continuing.

If a question can be answered by exploring the codebase, explore the codebase instead of asking.

When the grilling surfaces an architectural change too big for a single ADR, suggest escalating to `to-rfc` and stop.

</what-to-do>

<supporting-info>

## Inputs

Accept any of:

- A Story (GitHub issue reference `#NNN` or local markdown file)
- An RFC draft (`docs/rfcs/<n>-<slug>.md`)
- A free-form technical question tied to a Story

## Inputs to REFUSE

- An **Epic** → refuse with "Epic is product-team scope. Pick a Story under this Epic and try again."
- A **PRD** → refuse with "PRD is product-altitude. Grilling happens at Story level."

## Domain awareness

During codebase exploration, also look for existing documentation:

### File structure

Most repos have a single context:

```
/
├── CONTEXT.md
├── docs/
│   └── adr/
│       ├── 0001-event-sourced-orders.md
│       └── 0002-postgres-for-write-model.md
└── src/
```

If a `CONTEXT-MAP.md` exists at the root, the repo has multiple contexts. The map points to where each one lives:

```
/
├── CONTEXT-MAP.md
├── docs/
│   └── adr/                          ← system-wide decisions
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/adr/                 ← context-specific decisions
    └── billing/
        ├── CONTEXT.md
        └── docs/adr/
```

Create files lazily — only when you have something to write. If no `CONTEXT.md` exists, create one when the first term is resolved. If no `docs/adr/` exists, create it when the first ADR is needed.

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with `CONTEXT.md`, call it out immediately. *"Your glossary defines 'cancellation' as X, but you seem to mean Y — which is it?"*

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. *"You're saying 'account' — do you mean the Customer or the User? Those are different things."*

### Stress-test with concrete scenarios

When domain relationships are being discussed, probe edge cases that force precision about boundaries between concepts.

### Cross-reference with code

When the user states how something works, check whether the code agrees. Surface contradictions immediately: *"Your code cancels entire Orders, but you just said partial cancellation is possible — which is right?"*

### Update CONTEXT.md inline

When a term is resolved, update `CONTEXT.md` right there. Don't batch. Use [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md).

`CONTEXT.md` is glossary-only. Do not treat it as a spec, scratch pad, or repository for implementation decisions.

### Offer ADRs sparingly

Only offer an ADR when **all three** are true:

1. **Hard to reverse** — meaningful cost to change your mind later
2. **Surprising without context** — a future reader will wonder why
3. **The result of a real trade-off** — genuine alternatives existed

If any is missing, skip the ADR. Use [ADR-FORMAT.md](./ADR-FORMAT.md).

### Escalate to RFC when scope grows

If the grill surfaces a change that touches multiple subsystems, introduces a new external API, or requires a migration — stop and suggest the user run `to-rfc` to produce a formal proposal. ADRs are for single decisions; RFCs are for cross-cutting proposals.

</supporting-info>
