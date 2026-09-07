# syntax=docker/dockerfile:1.7
# ------------------------------------------------------------------
# API Vellor — imagem multi-stage, enxuta e sem root.
# Build: docker build -f apps/api/Dockerfile -t vellor-api .
# ------------------------------------------------------------------
ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

# ---------- dependências (todas) ----------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @vellor/api...

# ---------- build ----------
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @vellor/shared build && pnpm --filter @vellor/api build

# ---------- dependências de produção ----------
FROM base AS prod-deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter @vellor/api...

# ---------- runtime ----------
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=3001 \
    STORAGE_LOCAL_DIR=/data/uploads
RUN addgroup -S vellor && adduser -S -G vellor vellor \
    && mkdir -p /data/uploads && chown -R vellor:vellor /data
WORKDIR /app
COPY --from=prod-deps --chown=vellor:vellor /app/node_modules ./node_modules
COPY --from=prod-deps --chown=vellor:vellor /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps --chown=vellor:vellor /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=build --chown=vellor:vellor /app/packages/shared/dist ./packages/shared/dist
COPY --chown=vellor:vellor packages/shared/package.json ./packages/shared/package.json
COPY --from=build --chown=vellor:vellor /app/apps/api/dist ./apps/api/dist
COPY --chown=vellor:vellor apps/api/package.json ./apps/api/package.json
COPY --chown=vellor:vellor apps/api/drizzle ./apps/api/drizzle
USER vellor
WORKDIR /app/apps/api
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health >/dev/null || exit 1
CMD ["node", "dist/main.js"]
