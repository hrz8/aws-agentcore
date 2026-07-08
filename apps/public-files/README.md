# public-files

Static bucket mirror for `files.nd8.ai` — the CDN-fronted host for the chat widget bundle and shared public assets.

## What's in it

```
index.html                     # 403 landing page (bucket root)
favicon.ico
serve.json                     # `serve` config for local dev
widget-demo.html               # widget playground (basic-auth in prod)
public/                        # shared favicons
libs/chat-widget/latest/       # built widget bundle — output of `pnpm --filter frontend build:widget`
```

Nothing here is authored by hand except `index.html`, `widget-demo.html`, and favicons — `libs/chat-widget/latest/` is a build artefact.

## Local preview

```bash
pnpm --filter frontend preview:widget      # builds widget, serves this folder → http://localhost:4174
```

Open `/widget-demo.html` for the playground.

## Deploy

```bash
./scripts/files-push.sh [Dev|Prod]         # builds widget + `aws s3 cp` mirror + CloudFront invalidation
```

Reads bucket/distribution IDs from the CDK stack outputs — no CDK redeploy needed for content-only changes.
