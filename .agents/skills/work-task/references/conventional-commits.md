# Conventional commits + branch naming

Follows [Conventional Commits](https://www.conventionalcommits.org/). The skill enforces this for branches and commit messages.

## Commit types

| Type | Use for |
|---|---|
| `feat` | New user-facing capability |
| `fix` | Bug fix |
| `refactor` | Code restructure, no behavior change |
| `perf` | Performance improvement |
| `docs` | Documentation only |
| `style` | Formatting / whitespace / non-semantic |
| `test` | Tests only |
| `build` | Build system, deps, tooling |
| `ci` | CI/CD config |
| `chore` | Maintenance that doesn't fit above (lockfile bumps, generated files) |

## Scopes

Derive from the dominant path of the change. Conventions vary by repo; use the closest matching one:

- For a monorepo with `apps/<name>/` workspaces, the scope is the app name (`website`, `console`, `runtime`).
- For changes under `packages/<pkg>/`, the scope is the package name.
- For changes under `infra/`, the scope is `infra`.
- For root-level config (`turbo.json`, `pnpm-workspace.yaml`, `package.json`), omit the scope (`chore:` without parens).

If a change crosses scopes evenly, that's usually a sign it should be split into separate commits or PRs.

## Branch names

`<type>/<scope>-<short-slug>`

Examples:

- `feat/website-design-tokens`
- `fix/runtime-redis-reconnect`
- `refactor/console-auth-middleware`
- `docs/adr-0003-tool-tiers`
- `chore/deps-bump-astro-6.4`

Slug rules: lowercase, kebab-case, ≤4 words. Don't put the issue number in the branch name — it goes in the commit body via `Closes #NN`.

## Commit subject

```
<type>(<scope>): <imperative present-tense summary>
```

Rules:

- ≤72 characters total
- No trailing period
- Imperative mood ("add", not "added" or "adds")
- Lowercase after the colon, except for proper nouns and acronyms

Examples:

- `feat(website): add color, radius, gradient, glow design tokens`
- `fix(runtime): handle SSE reconnect when redis buffer drops`
- `refactor(console): extract session JWT minting into a service`

## Commit body

Wrap at 72 columns. Explain the **why** more than the what (the diff shows the what). Reference the issue(s):

```
feat(website): add color, radius, gradient, glow design tokens

Implements the colors/radii/gradient/glow slice of ADR-0002. Token
names verbatim from the locked Figma source, namespaced into Tailwind
v4 @theme slots so bg-/text-/border-/rounded- utilities generate
automatically. Body class swapped to use the new tokens.

Closes <owner>/<repo>#4
Refs <story-owner>/<story-repo>#13
```

- `Closes <ref>` triggers GitHub auto-close on merge. Use the full `owner/repo#NN` form for cross-repo refs; `#NN` is enough for same-repo.
- `Refs <ref>` (no auto-close) for the parent Story, Epic, or related context the merge shouldn't close.

## What NOT to do

- ❌ `update files` — no type, no info
- ❌ `feat: WIP design tokens` — no scope, "WIP" not a real description
- ❌ `feat(website): add design tokens.` — trailing period
- ❌ Wrapping the issue number in the subject: `feat(website): #4 add ...` — it belongs in the body
- ❌ `--amend` to a published commit — create a follow-up commit instead
