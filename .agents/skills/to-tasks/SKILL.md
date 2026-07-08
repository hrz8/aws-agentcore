---
name: to-tasks
description: Break a GitHub Story issue into Task sub-issues, each its own GitHub issue under the Story. Each Task body inlines the relevant technical context (ADR references, key decisions, glossary terms) so an engineer or AFK agent can pick it up self-contained. Auto-detects if grilling was done first. Use when an engineer has picked up a Story and wants to create concrete Task issues for the implementation steps.
---

# To Tasks

Create Task sub-issues under a GitHub Story. Tasks live as their own GitHub issues — consistent with the Epic → Story → Task hierarchy — so each Task has its own assignee, PR link, and closure.

## Inputs

One of:

- GitHub Story issue reference (`#NNN` or URL) — preferred
- Path to a local Story markdown file

## Process

### 1. Detect grilling state

Scan for signals that this Story was grilled:

| Signal | Strength |
|---|---|
| ADRs in `docs/adr/` created within last 7 days that reference this Story ID or its key terms | Strong positive |
| `CONTEXT.md` modified within last 7 days | Weak positive |
| Story body contains a "Technical Approach" or "Implementation Notes" section | Positive |
| Story has acceptance criteria but no technical sections AND is older than 1 day | Negative |

If detection is **negative or absent**: warn the user. Pass `--skip-grill-check` to proceed anyway.

### 2. Gather context

- Fetch the Story body: `gh issue view <NNN> --json title,body,labels`.
- Read `CONTEXT.md` (root).
- Read recent ADRs in `docs/adr/` — these populate each Task's "Technical context" section.

### 3. Clarify if unclear

If the Story has vague acceptance criteria, unspecified deliverables, or gaps the ADRs don't cover, ask up to 7 clarifying questions — one at a time. Skip if it's clear.

### 4. Draft the tasks

Each Task must:

- Be **≤ 4 hours** of work. Split larger tasks.
- Have a clear deliverable (component, endpoint, test passing).
- **Inline the relevant technical context** — ADR references, key constraints, terminology from CONTEXT.md — so the Task issue is self-contained for whoever picks it up.

### 5. Quiz the user (single round)

Show the draft. Ask: granularity right? dependencies right? technical context complete? Apply edits, then proceed.

### 6. Publish as sub-issues

Create each Task as a sub-issue under the Story via `gh issue create` + `gh issue edit --add-sub-issue`. Publish in dependency order so you can reference real issue numbers in `## Depends on`. Use [TASK-FORMAT.md](./TASK-FORMAT.md) for body content.

Apply labels: `task` + `area:<slug>` inferred from the Story. Create any missing label with `gh label create <name> --color <hex>` before assigning.

## What this skill does NOT do

- Make implementation decisions — those belong in ADRs.
- Estimate beyond hours.
- Close or modify the parent Story issue.

## Refusal conditions

- No `CONTEXT.md` or `docs/adr/` at the repo root.
- Story is closed or has no body content.

## Escape flag

- `--skip-grill-check` — proceed without warning if grilling not detected.
