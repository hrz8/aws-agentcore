# AgentCore requires linux/arm64.

# ---- Build ----
FROM --platform=linux/arm64 public.ecr.aws/docker/library/node:24-slim AS build
WORKDIR /repo
RUN corepack enable

# Manifests first for Docker layer cache.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/agent/package.json ./apps/agent/
COPY packages/kit/package.json ./packages/kit/
COPY packages/registry/package.json ./packages/registry/
COPY packages/skills/package.json ./packages/skills/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/vitest-config/package.json ./packages/vitest-config/
RUN pnpm install --frozen-lockfile

# Sources + build order: kit → registry → skills → agent.
COPY packages/typescript-config/ ./packages/typescript-config/
COPY packages/kit/ ./packages/kit/
COPY packages/registry/ ./packages/registry/
COPY packages/skills/ ./packages/skills/
COPY apps/agent/ ./apps/agent/
RUN pnpm --filter @repo/kit build \
 && pnpm --filter @repo/registry build \
 && pnpm --filter @repo/skills build \
 && pnpm --filter agent-runtime build

# Resolve catalog:/workspace: refs into a self-contained prod snapshot.
RUN pnpm --filter agent-runtime deploy --prod --legacy /out

# ---- Runtime ----
FROM --platform=linux/arm64 public.ecr.aws/docker/library/node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/dist ./dist
COPY --from=build /out/package.json ./
EXPOSE 8080
CMD ["node", "dist/main.js"]
