# Task Issue Body Format

Each Task is its own GitHub issue, created as a sub-issue under a Story.

## Template

```md
## Parent Story
<link to Story issue>

## What to do
<1-2 sentences describing the deliverable>

## Technical context
<Inline the technical decision(s) that inform this Task. Quote or summarise the key
constraints and reference ADRs / RFCs by filename. Example:
"Validation uses zod per `docs/adr/0007-validation-library.md`. Must also validate
server-side — see `docs/rfcs/0003-form-pipeline.md` §4."

If no special context applies, write "Follows general project conventions.">

## Estimate
~Xh

## Depends on
- #NNN (other Task issues that must complete first)
- Or "None — can start immediately"
```

## Rules

- **Inline the technical context** — don't just link to ADRs; summarise the relevant constraints so the Task is self-contained for whoever picks it up.
- **Parent link required** — Task → Story via `gh issue edit --add-sub-issue`.
- **Estimate in hours**, capped at 4h per Task. Split larger work.
- **Dependencies by issue number** — reference real `#NNN` once blockers are created.
- **Labels**: apply `task` plus the area label (e.g. `area:marketing-site`) inferred from the parent Story.
