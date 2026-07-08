# @repo/kb

Knowledge-base repository — file uploads (PDF/DOCX/TXT) and web ingest, backed by S3 + Bedrock KB. Consumed by `apps/middleware` and `apps/dashboard`.

## Exports

| Entry | What it is |
|---|---|
| `.` | `KbRepository` interface + domain types + `WebIngestService` |
| `./domain` | domain types only |
| `./interface` | `KbRepository`, input types |
| `./errors` | typed error classes |
| `./adapters/s3-bedrock` | `S3BedrockKbRepository` — production adapter (S3 uploads + Bedrock KB indexing) |
| `./adapters/memory` | `InMemoryKbRepository` — for tests |
| `./testing` | shared contract tests (both adapters must pass) |

## Shape

```ts
import { S3BedrockKbRepository } from '@repo/kb/adapters/s3-bedrock';
import { WebIngestService } from '@repo/kb';

const kb = new S3BedrockKbRepository({ /* bucket, kbId, region, ... */ });
await kb.presignUpload(scope, { filename: 'doc.pdf', contentType: 'application/pdf' });
await kb.startIngestion(scope);           // triggers Bedrock KB sync

const web = new WebIngestService(kb, { maxUrls: 100, rateLimitMs: 1000 });
await web.ingestUrl(scope, 'https://example.com/page');
await web.crawlSitemap(scope, 'https://example.com/sitemap.xml');
```

Every method takes a `Scope` (`{ tenantId, agentId, version }` from `@repo/kit/identity`). File writes land at the S3 prefix that scope resolves to.

## Web ingest

Fetches via `crawler/fetch-page` with:
- `robots-parser` — respects `robots.txt`; rejected URLs raise `WebIngestRejectedError`
- `HostRateLimiter` — per-host throttle (default 1s)
- `fast-xml-parser` — sitemap discovery + traversal (default cap 100 URLs)

## Scripts

```bash
pnpm --filter @repo/kb build          # tsc → dist/
pnpm --filter @repo/kb test           # vitest (contract suite runs both adapters)
pnpm --filter @repo/kb typecheck
```
