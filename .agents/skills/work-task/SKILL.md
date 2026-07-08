---
name: work-task
description: Implement a GitHub Task issue end-to-end — research (issue + parent Story + ADRs + CONTEXT.md + Figma if linked) → clarify only if blocked → implement → verify → review → conventional commit + PR. Use this whenever the user invokes /work-task with a GitHub issue reference (#NN, owner/repo#NN, or URL), or asks to "work on", "pick up", or "do" a Task issue. Procedural — follow the steps in order. Bias toward acting without asking; ask only when genuinely blocked on a decision the issue can't resolve.
---

# work-task

Implement a GitHub Task from research through pushed PR. Procedural. Load detail from `references/` only when you need it.

## Inputs

`$ARGUMENTS` is one of: `#NN` (current repo), `owner/repo#NN`, or a full GitHub issue URL. If empty or malformed, ask once and stop.

## Pipeline

`PARSE → RESEARCH → (CLARIFY?) → PLAN → IMPLEMENT → VERIFY → REVIEW → TRIAGE → BRANCH+COMMIT → PUSH → PR`

## 1. Parse

Resolve `$ARGUMENTS` to `(owner, repo, issue_number)`. Ambiguous → ask once.

## 2. Research (parallel)

Pull source material to ground the implementation:

- **Task issue** via `gh issue view <NN> --repo <owner/repo> --json title,body,author,assignees,labels,comments,state,url`. Scan `comments` — a prior `/work-task` run may have asked a question that's now been answered; that answer is your input.
- **Parent Story / Epic** if the Task body links one (often a different repo) — fetch the same way
- **Linked ADRs** — `docs/adr/*.md` (or wherever this repo keeps them)
- **CONTEXT.md** at repo root and any scope-specific one (`apps/<app>/CONTEXT.md`, `packages/<pkg>/CONTEXT.md`); `CONTEXT-MAP.md` if present
- **Figma** — Figma MCP server `get_variable_defs(<node-id>)` to verify hex / token values
- **Existing files** named in the Task body

Missing optional sources (no Figma MCP, no ADR dir) — note and continue.

## 3. Clarify (when blocked, never assume)

If unclear or blocked, pick the venue by who can actually answer:

- **Prompter can answer it** (engineering choice in their wheelhouse, scope question about work they own) → ask directly in chat. 1–3 focused questions, then wait.
- **Needs the Task author** (different person from the prompter, or audit trail wanted on the decision) → comment on the **Task issue**, tag `author.login` from Step 2 — they're usually the tech lead.
- **Product / story-scope question** (AC interpretation, scope, ownership) → comment on the **parent Story or Epic**, tag that author.

For GitHub comments: `gh issue comment <NN> --repo <owner/repo> --body "..."`, surface the URL in chat, stop. Resume on next `/work-task` — Step 2 picks up the reply.

A confident judgment call surfaced in your status update isn't a blocker — that's transparency. Never ask "should I proceed?".

## 4. Plan

>3 files or architectural choices → brief task list. 1–2 edits → skip the planner.

## 5. Implement

Honor scope discipline — if the Task body splits work across follow-up Tasks, don't touch those files. Surface judgment calls once so the user can redirect early.

## 6. Verify

Run the repo's verification commands (read `package.json` scripts / `Makefile` / `CONTEXT.md`). For ACs naming a specific artifact ("`bg-foo` utility must exist", "endpoint `/v1/bar` returns 200"), grep / curl / inspect the actual output — don't trust "it should work".

For DB-touching changes, confirm partition-key columns are filtered in every WHERE clause that hits a partitioned table (CONTEXT.md names them).

## 7. Review

In parallel, invoke the reviewers that apply (`website-reviewer`, `a11y-reviewer`, plus any repo-specific ones). Brief each with: issue URL, relevant ADR paths, files changed, specific concerns.

## 8. Triage

Findings tagged `[BLOCKER]` / `[SUGGEST]` / `[NIT]`. Apply real BLOCKERs + cheap SUGGESTs; reject false positives explicitly. Re-verify after fixes.

## 9. Branch + commit + push

See `references/conventional-commits.md`.

- Branch: `<type>/<scope>-<short-slug>`
- Stage **explicit paths only** — `git add path1 path2`, never `-A` / `.`. Re-check via `git status --short`.
- Commit subject: `<type>(<scope>): <imperative>`. Body has `Closes <ref>` / `Refs <ref>`.
- **GPG signing failure** → STOP and tell the user. Don't retry blindly, don't `--no-gpg-sign`.
- Push: `git push -u origin <branch>`.

## 10. PR

Read `.github/PULL_REQUEST_TEMPLATE.md` and fill in: Summary, AC checklist (✅/☐/⚠), Design decisions, Test plan. Title = commit subject. Base = `main` unless CONTEXT.md says otherwise. Use `gh pr create --base main --head <branch> --title <title> --body "$(cat <<'EOF' ... EOF)"`. Return the PR URL.

## Boundaries

- Never commit/push unprompted. `/work-task` implies the full pipeline; research-only stops at step 8.
- Never stage files outside your edit set.
- Never bypass signing or hooks (`--no-gpg-sign`, `--no-verify`).
- Never close the Task issue manually — `Closes <ref>` does it on merge.
- Never force-push a protected branch; for feature-branch rebase, confirm first.

## Pointers

- `references/workflow.md` — expanded walkthrough + worked example
- `references/conventional-commits.md` — branch + commit naming
- `.github/PULL_REQUEST_TEMPLATE.md` — PR body skeleton (project root)
- `.agents/{website,a11y}-reviewer.md` — reviewer agent definitions
