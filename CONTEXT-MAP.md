# Context Map

This repository hosts multiple bounded contexts. Each one owns its own glossary and architectural decisions.

| Context | Glossary | ADRs | Scope |
|---|---|---|---|
| **Marketing site** | [./apps/website/CONTEXT.md](./apps/website/CONTEXT.md) | [./apps/website/docs/adr/](./apps/website/docs/adr/) | `nd8.ai` static marketing site (Astro + S3 + CloudFront + GitHub Actions). Separate from the platform runtime — different domain, different audience, different infra. Code under [./apps/website/](./apps/website/). |

When a context-specific glossary doesn't exist yet, the `grill-with-context` skill creates it lazily — only when the first term needs recording.
