# Issue Body Templates

## Epic issue

```md
## Parent
<link to PRD / Spec / RFC permalink>

## Summary
<one paragraph from the source doc's Summary or Goals section>

## Why this is an epic
<one paragraph from the source doc>

## Stories
- #NNN — <Story title>
- #NNN — <Story title>

## Acceptance criteria (epic-level)
- [ ] ...

## Dependencies
- ...

## Out of scope
- ...
```

## Story issue (sub-issue of Epic)

```md
## Parent
<link to Epic issue>

## Story
> **As a** <user>, **I want to** <action> **so that** <benefit>

## Why this matters
<one paragraph>

## Acceptance criteria

### Happy path
- [ ] ...

### Validation
- [ ] ...

### Failure modes
- [ ] ...

### Accessibility
- [ ] ...

## Design
<Figma URL or design brief link, if any>

## Definition of Done
- All acceptance criteria checked
- Code reviewed and merged to `main`
- Deployed to production
- (Other DoD per repo conventions)
```

## Rules

- **Parent links go both ways.** Sub-issue → parent via `gh issue edit --add-sub-issue` AND parent body lists children by number.
- **Acceptance criteria copied from source doc** — do not invent new criteria.
- **Task sub-issues** are created later by `to-tasks` and appear automatically in GitHub's sub-issues panel; no placeholder needed in the Story body.
- **Labels**: apply `epic`, `story`, plus the area label (e.g., `area:marketing-site`) inferred from source doc filename or content.
