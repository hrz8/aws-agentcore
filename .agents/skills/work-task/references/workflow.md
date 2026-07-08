# Workflow walkthrough

Expanded version of the SKILL.md pipeline, with a worked example.

## Worked example

A `/work-task` invocation against a Task issue that asks for design-token additions to a static marketing site. Here is what each step actually looks like.

### Parse

```
$ARGUMENTS = "#4"
gh repo view --json owner,name → <owner>/<repo>
→ (owner, repo, issue_number=4)
```

### Research (parallel)

```
gh issue view 4 --repo <owner>/<repo> --json title,body,labels,...
gh issue view 13 --repo <story-owner>/<story-repo> --json ...    # parent Story from body
read <adr-dir>/0002-design-tokens.md                              # linked ADR
read CONTEXT.md                                                   # root vocabulary
read CONTEXT-MAP.md                                               # context map (if present)
read apps/<app>/CONTEXT.md                                        # scoped vocabulary
read apps/<app>/src/styles/global.css                             # file the Task names
read apps/<app>/src/layouts/Layout.astro                          # file the Task names
figma-mcp: get_variable_defs(nodeId="29:5768")                    # verify hex values
```

If the Task body cites a Figma node, use the Figma MCP server to confirm values rather than trust the body verbatim. Drift between issue text and Figma is the most common silent error.

### Clarify

In this example there was one ambiguity worth flagging mentally: the ADR named tokens `--accent`, but Tailwind v4 only generates utilities (`bg-accent`) from `--color-*`-namespaced theme variables. The Task body's body-class example (`bg-bg text-ink-body`) only works with `--color-*` prefixes. Internal contradiction in the source material.

This one resolved internally — only one interpretation is consistent with the rest of the spec, so the skill surfaces the call in the status update and continues. Use this judgment sparingly: **when the source material genuinely doesn't resolve the question, never assume.** Ask.

#### Who to ask

Three-tier routing, in order:

1. **Prompter** — if the dev currently driving the session can answer (an engineering choice they own, a scope question about their own work) → ask directly in chat. One round, 1–3 focused questions, wait. Cheapest interaction, no GitHub round-trip.
2. **Task issue comment** — if the Task author is someone other than the prompter (a different tech lead, or you want the decision on the record) → comment on the Task issue and tag the author.
3. **Parent Story / Epic comment** — if the question is about product scope, AC interpretation, or whether the work belongs in this Story at all → comment on the parent issue and tag its author. Product side, not tech side.

Comment shape — short and answerable, with a clear ask:

```bash
gh issue comment <NN> --repo <owner/repo> --body "$(cat <<'EOF'
@<task-or-story-author> blocking `/work-task` on this issue:

<one-line summary of what's ambiguous>

<2–4 lines of evidence: which source materials disagree, what the two
interpretations are, and what you'd default to if forced to pick>

Could you confirm direction? Pausing until then.
EOF
)"
```

After posting, surface the comment URL in chat and stop. The next `/work-task` invocation re-reads all comments in Step 2 and continues from the reply — you don't need to track state between runs.

If the question is partially answerable from the existing material (you're 80% confident), state your default in the comment so the author can confirm with a thumbs-up instead of writing prose. Lower-cost interaction.

### Plan

Two edits — small enough to skip the planner. For larger Tasks (e.g. "build a showcase surface + write a contrast-matrix script + wire Lighthouse"), break into a task list.

### Implement

Edit the named files. Honor the Task scope: if Task #N is "colors and radii only", spacing scale and typography go in Tasks #N+1 and #N+2. Don't sneak in cleanup of an unrelated `text-slate-600` you happen to notice — that drift belongs in the lint task.

### Verify

```
pnpm typecheck     # 0 errors
pnpm build         # completes
grep -oE '\.bg-bg|\.text-ink-body|\.bg-gradient-accent|\.bg-glow-amber' dist/_astro/*.css
```

The grep is the AC check made literal. "The utility class exists in the build output" is verifiable; "I added the token" is not.

### Review

Two reviewers in parallel:

```
website-reviewer  ← "Review for Tailwind v4 idiomatic-ness. Files: ... ADR: ..."
a11y-reviewer     ← "Compute contrast for #1A1A1A on #FDF9F2. Files: ..."
```

### Triage

Reviewer flagged: the gradient definition duplicated `#FFB900` / `#FF7A4D` as literals instead of `var(--color-accent)` / `var(--color-gradient-to)` — if the source color is ever retuned, the gradient drifts silently. Cheap fix, applied.

Reviewer also flagged: ADR-0002 §1 names disagreed with the implementation. Real doc drift, but ADR edits are out of scope for this Task. Mentioned in the PR description; file a follow-up if the user wants.

### Branch + commit

```
git checkout -b feat/website-design-tokens
git add apps/<app>/src/styles/global.css apps/<app>/src/layouts/Layout.astro
git status --short    # confirm only those two paths are M-staged
git commit -m "feat(website): add color, radius, gradient, glow design tokens..."
```

If GPG fails, stop and ask the user to unlock. Don't retry-loop, don't `--no-gpg-sign`.

### Push + PR

```
git push -u origin feat/website-design-tokens
gh pr create --base main --head feat/website-design-tokens \
  --title "feat(website): add color, radius, gradient, glow design tokens" \
  --body "$(cat <<'EOF' ... template ... EOF)"
```

## Patterns and gotchas

### Cross-repo issues

Some workflows split Story issues (product / planning repo) from Task issues (engineering repo). When the Task body links its parent with `<story-owner>/<story-repo>#<N>`, the parent lives in a different GitHub repo than the Task. The PR's `Closes <task-repo>#<NN>` auto-closes the Task; the parent Story closes manually when all sub-Tasks merge. Don't try to close cross-repo parents from the eng PR — GitHub doesn't reliably auto-close across repos.

### Partitioned tables

If `CONTEXT.md` flags certain tables as partitioned (by `tenant_id`, `account_id`, or whatever the project's primary partition key is), the verification step must confirm the partition key is in every WHERE clause that hits those tables — otherwise the planner can't prune partitions and the query scans everything. The skill should re-read the relevant migration and the query to verify.

### Figma MCP unavailable

If the Figma MCP server isn't connected, you can still proceed — the Task body and ADR usually have the values inline. Note the unavailability in the plan and in the PR description's "Test plan" section. Don't fabricate that you verified against Figma.

### Dirty files in the working tree

If the user has uncommitted changes unrelated to the Task, do NOT include them. The contract is: explicit `git add <paths>`, never `-A`. Re-confirm with `git status --short` between `git add` and `git commit`. The dirty files belong to the user; leave them alone.

### Branch naming when a Task touches multiple scopes

Pick the dominant scope. If a Task touches both `apps/website` and `infra/`, and 80% of the change is the website, use `feat/website-...`. Multi-scope branches like `feat/website-and-infra-...` are a smell — usually a sign the Task is two Tasks.
