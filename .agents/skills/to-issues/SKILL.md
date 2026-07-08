---
name: to-issues
description: Break a PRD, Feature Spec, RFC, or existing Epic into independently-grabbable GitHub issues using tracer-bullet vertical slices. Creates an Epic issue with Story sub-issues, sets a Milestone from the source doc's target date, and writes the resulting issue numbers back to the source doc. Asks up to maximum 7 clarifying questions first if the source doc is sparse. Use when a PM or eng lead has an approved doc ready to be broken down into actionable engineering work.
---

# To Issues

Break a plan into independently-grabbable issues using **vertical slices** (tracer bullets). Each issue is a thin slice cutting through ALL layers end-to-end, NOT a horizontal slice of one layer.

## Inputs

One of:

- Path to a PRD: `docs/prds/<slug>.md`
- Path to a Feature Spec: `docs/specs/<slug>.md`
- Path to an RFC: `docs/rfcs/<n>-<slug>.md`
- GitHub Epic issue reference (`#NNN` or URL) — produces Stories under it

## Process

### 1. Gather context

Read the source doc. If it's a GitHub issue reference, fetch with `gh issue view <NNN> --json title,body`.

**Refuse if the source doc has a non-empty `## Open Questions` section** — tell the user: "Unresolved Open Questions block breakdown. Resolve them first (update the doc or re-run `to-prd` / `to-feature-spec` / `to-rfc`) before breaking into issues." Do not proceed.

### 2. Clarify if unclear

If the source doc has empty required sections, vague language, or terms not in the glossary, ask up to maximum 7 clarifying questions — one at a time. Skip if it's already clean.

### 3. Plan the issue tree

Detect input level, then **ask the user which level to generate** (don't auto-generate Epics AND Stories in one go — that decision is theirs):

| Input | Options to offer |
|---|---|
| PRD (multi-epic) | (a) Epics only — staged; come back later with `to-issues #<epic>` to create Stories per Epic. (b) Epics + Stories now. |
| Feature Spec (medium) | (a) Epic only. (b) Epic + Stories. |
| Feature Spec (small, <4 stories) | Just Stories (auto — too small to stage) |
| RFC | (a) Epic only. (b) Epic + Stories. |
| Existing Epic issue | Just Stories under it (auto — Epic already exists) |

Wait for the choice. For "Epic only" flows, tell the user at the end: "When ready, run `to-issues #<epic-num>` to break each Epic into Stories."

### 4. Draft vertical slices

Each Story must be a **tracer bullet**:

<vertical-slice-rules>
- Cuts through every layer (schema → API → UI → tests) — NOT one layer in isolation
- Demoable/verifiable on its own
- Prefer many thin slices over few thick ones
- Mark each as **HITL** (human-in-the-loop, needs design review or arch decision) or **AFK** (an AFK agent can complete end-to-end). Prefer AFK.
</vertical-slice-rules>

### 5. Quiz the user on the breakdown

Present the plan as a numbered list. For each Story show: title, type (HITL/AFK), blocked-by, parent Epic. Ask:

- Granularity right?
- Dependencies right?
- Anything to merge/split?

Iterate until approved.

### 6. Publish

Create Epic issues first with `gh issue create`, then Story issues and attach them under their Epic via `gh issue edit <story-num> --add-sub-issue <epic-num>`. Publish in dependency order (blockers first) so you can reference real issue numbers. Use [ISSUE-TEMPLATES.md](./ISSUE-TEMPLATES.md) for body content.

Apply labels: `epic` on Epic issues, `story` on Story issues, plus `area:<slug>` inferred from the source doc filename. Create any missing label with `gh label create <name> --color <hex>` before assigning.

Set **Milestone** from the source doc's target date:

- PRD with `Target launch: <date>` → milestone `<product> v1.0 - <month-year>`
- Spec with `Target ship date: <date>` → milestone `<feature-name> - <month-year>`
- RFC with no target → skip milestone

If running from a repo without code (e.g. the product team docs repo), pass `--repo <owner>/<eng-repo>` to target the repo where issues should be created.

### 7. Write issue numbers back to the source doc

Append (or update) a `## GitHub Issues` section in the source doc listing the created Epic + Story issues with permalinks. This is the bidirectional link.

## Output

- New GitHub issues (Epic + Story tree) with sub-issue relationships.
- Milestone created/found and applied.
- Source doc updated with the issue list.

## What this skill does NOT do

- Break Stories into Engineering Tasks.
- Modify or close any parent issue.
