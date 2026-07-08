# ADR 0001: Preview strategy — shared Dev URL, not per-PR ephemeral environments

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-06-16 |
| **Deciders** | Hirzi |
| **Supersedes** | — |
| **Superseded by** | — |

## Context

Story #12 (Site foundation Epic) includes the acceptance criterion *"any commit to a PR triggers an automated build and surfaces the preview URL on the PR."* A literal reading suggests every PR deploys its own ephemeral preview environment (e.g. `pr-NNN.dev.nd8.ai`) — the shape teams using Vercel / Netlify / Cloudflare Pages get for free.

The marketing site does not run on a preview-native host. It is deployed via CDK to S3 + CloudFront in a per-Stage account (`Dev`, `Prod`) — chosen for posture continuity with the rest of the platform infra and to keep hosting under the same AWS account where Bedrock, KMS, and the runtime live. The PRD's strong default (§6) explicitly names this stack and treats deviation as ADR-worthy.

That base means "per-PR preview" is not a config toggle — it requires building it. Two viable shapes:

1. Per-PR ephemeral CloudFront distributions, torn down on PR close.
2. Single CloudFront with S3 path-prefix routing (`/_previews/pr-NNN/...`), cleaned up on PR close.

Both add a non-trivial chunk of infra surface: lifecycle workflows on PR open / sync / close, IAM scoping per preview, DNS or path routing, cache invalidation per preview, cleanup automation. The site is a low-traffic marketing surface in a small-team early-stage product. The PR cadence does not yet justify that surface.

## Decision

**The shared `Dev` Stage URL is the preview surface for the marketing site.** PRs do not deploy. The PR-triggered workflow runs `cdk diff` (and CI checks: lint, typecheck, lhci smoke against locally-built `dist/`). The `Dev` URL is redeployed on every push to `main`; reviewers demo against `Dev` after merge.

Story #12's *"preview URL on PR"* AC is reinterpreted as *"the team has a working deploy URL that updates predictably as PRs merge"* — not as *"every PR gets its own ephemeral URL."*

## Alternatives Considered

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| Per-PR ephemeral CloudFront distributions | Closest to the literal AC; high demo fidelity; preview survives even if `main` is broken | Per-distribution provisioning latency (~15 min CF deploy); per-PR IAM + DNS surface; cleanup-on-close automation; cost scales with open PR count; new failure modes (orphaned distributions, DNS leftovers) | **Rejected for v1** — surface cost out of proportion to current PR volume |
| S3 path-prefix previews (`/_previews/pr-NNN/`) on one CloudFront | One distribution; lighter ops; reasonable demo fidelity | Asset paths and routing must be relative — Astro defaults to absolute base paths; requires per-build base config; SPA fallback rules need per-prefix carve-outs; cleanup still required | **Rejected for v1** — cheaper than (1) but still meaningful tooling investment with no current customer |
| Build artifact only (upload `dist/` as PR artifact) | No infra; works today | No clickable demo URL — defeats the spirit of the AC; reviewers must download + serve locally | **Rejected** — worse than the chosen path |
| **Shared `Dev` URL, post-merge** | Zero new infra; uses the deploy pipeline that already ships the site; reviewers see exactly what production sees after merge | Cannot demo a PR live before merge; broken merge to `main` breaks all previews until fixed; reviewers rely on local `pnpm dev` + screenshots during review | **Chosen** |

## Consequences

### Positive

- Story #12 closes without standing up additional infra. The deploy pipeline already built for the site is sufficient.
- One CloudFront distribution per Stage. No PR-scoped IAM, DNS, or cleanup automation.
- Reviewers see the same artifact that ships — no chance of "preview environment drift" hiding a bug that only appears in real deploys.

### Negative

- Reviewers cannot share a clickable URL for a PR's changes during review. Reviewing visual changes requires local `pnpm --filter website dev` or screenshots in the PR description.
- A broken merge to `main` takes the shared `Dev` URL down for everyone until fixed — there is no "PR preview" to fall back to. Mitigation: lhci + lint + typecheck on PR are configured to block merge on failure.
- The Story #12 AC text *"preview URL on PR"* is not literally satisfied. Anyone reading the AC without this ADR will be confused; this ADR exists specifically to close that gap.

## Revisit triggers

Reconsider per-PR previews if **any** of:

- PR cadence on `apps/website/` exceeds ~5 open PRs at once and reviewers regularly need to compare visual changes side-by-side.
- A non-engineer stakeholder (design, marketing, exec) is routinely blocked on reviewing a PR before merge.
- The team adopts a preview-native host (Vercel / Netlify / Cloudflare Pages) for the marketing site for other reasons, making per-PR previews free.

Until then, the answer to *"can we get a preview URL for this PR?"* is *"merge it to `main` and check the `Dev` URL."*
