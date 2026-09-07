# syntax=docker/dockerfile:1.7
# ------------------------------------------------------------------
# Web Vellor — build estático servido pelo Caddy (único ingress público).
# Build: docker build -f apps/web/Dockerfile -t vellor-web .
# ------------------------------------------------------------------
ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @vellor/web...
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @vellor/shared build && pnpm --filter @vellor/web build

FROM caddy:2-alpine AS runtime
COPY infra/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv
EXPOSE 80 443 443/udp
