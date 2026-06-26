# AgentCore Runtime requires linux/arm64 images.
# Multi-stage: build TS with full deps, ship a slim runtime image with prod deps only.

# ---- Build stage ----
FROM --platform=linux/arm64 public.ecr.aws/docker/library/node:24-slim AS build

WORKDIR /app

# Corepack ships with Node 24 and resolves pnpm from `packageManager` in package.json.
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src/ ./src/
RUN pnpm build

# Drop dev deps so we can copy a lean node_modules into the runtime stage.
RUN pnpm prune --prod

# ---- Runtime stage ----
FROM --platform=linux/arm64 public.ecr.aws/docker/library/node:24-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# AgentCore Runtime contract: container listens on 0.0.0.0:8080.
EXPOSE 8080

CMD ["node", "dist/main.js"]
