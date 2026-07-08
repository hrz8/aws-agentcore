# CONTEXT.md Format

`CONTEXT.md` lives at the repo root and is the canonical engineering glossary. The `grill-with-context` skill keeps it accurate.

## Glossary section

The glossary is the highest-leverage part of the file. Format:

```md
## Language

**Booking**:
A confirmed reservation against a specific room and date range. Lifecycle: held → confirmed → checked-in → checked-out / cancelled.
_Avoid_: Reservation, hold, stay

**Cancellation**:
A booking state transition that releases the room hold and may trigger a refund per the rate plan's cancellation policy. NOT the same as a refund (refunds can also happen post-checkout).
_Avoid_: Refund, void
```

## Rules

- **Be opinionated.** When multiple words exist for the same concept, pick the best one and list the others under `_Avoid_`.
- **Keep definitions tight.** One or two sentences max. Define what it IS, not what it does.
- **Only include terms specific to this codebase's domain.** Generic engineering concepts (cache, queue, retry) don't belong unless they have a domain-specific meaning here.
- **Group terms under subheadings** when natural clusters emerge.

## The rest of the file

Beyond the glossary, the rest of `CONTEXT.md` carries system-shape framing (one-time setup):

- **What this codebase does** — one paragraph
- **Top-level architecture** — services, data stores, external integrations
- **Domain glossary** (`## Language`) — the section the grill maintains
- **Boundaries** — what's IN this codebase vs adjacent ones (if multi-repo)

The grill treats everything except `## Language` as read-only context.

## Single vs multi-context setups

For a single bounded context: one `CONTEXT.md` at repo root.

For multiple bounded contexts: a `CONTEXT-MAP.md` at root, plus a per-context `CONTEXT.md` inside each subsystem folder. The grill infers which one applies; if unclear, asks.
