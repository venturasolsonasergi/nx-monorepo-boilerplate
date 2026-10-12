# Production image for the API host (apps/api), multi-stage per
# openspec/changes/add-production-deploy-path/design.md decision 2.
# Build context is the repository root: docker build -f docker/api/Dockerfile .

ARG PNPM_VERSION=11.10.0

# ---------------------------------------------------------------------------
# Build stage: install all dependencies, generate Prisma clients, compile dist/
# ---------------------------------------------------------------------------
FROM node:26-alpine AS build
ARG PNPM_VERSION
WORKDIR /app

# Placeholder URLs only resolve the prisma.config.ts datasource at generate
# time; no database connection is made during the build.
ENV AUTH_DATABASE_URL="postgresql://localhost:5432/auth_db?schema=public" \
    USERS_DATABASE_URL="postgresql://localhost:5432/users_db?schema=public" \
    ORDERS_DATABASE_URL="postgresql://localhost:5432/orders_db?schema=public"

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.json tsconfig.base.json tsconfig.build.json nest-cli.json ./
RUN npm install -g "pnpm@${PNPM_VERSION}" && pnpm install --frozen-lockfile

COPY apps/ ./apps/
COPY libs/ ./libs/
COPY scripts/ ./scripts/

RUN pnpm api:build

# ---------------------------------------------------------------------------
# Runtime dependency stage: production dependency subset only. The Prisma CLI
# (and dotenv, imported by every prisma.config.ts) are regular dependencies so
# the entrypoint can run `migrate deploy`.
# ---------------------------------------------------------------------------
FROM node:26-alpine AS runtime-deps
ARG PNPM_VERSION
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN npm install -g "pnpm@${PNPM_VERSION}" && pnpm install --frozen-lockfile --prod

# ---------------------------------------------------------------------------
# Runtime stage: non-root, tini init, compiled dist + per-service Prisma
# config/schema/migrations for the entrypoint's migrate deploy.
# ---------------------------------------------------------------------------
FROM node:26-alpine AS runtime
RUN apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

COPY --from=runtime-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist/apps ./dist/apps
COPY --from=build --chown=node:node /app/dist/libs ./dist/libs

COPY --chown=node:node libs/auth/infrastructure/prisma/prisma.config.ts \
     libs/auth/infrastructure/prisma/schema.prisma \
     ./libs/auth/infrastructure/prisma/
COPY --chown=node:node libs/auth/infrastructure/prisma/migrations/ ./libs/auth/infrastructure/prisma/migrations/
COPY --chown=node:node libs/users/infrastructure/prisma/prisma.config.ts \
     libs/users/infrastructure/prisma/schema.prisma \
     ./libs/users/infrastructure/prisma/
COPY --chown=node:node libs/users/infrastructure/prisma/migrations/ ./libs/users/infrastructure/prisma/migrations/

COPY --chown=node:node docker/api/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER node
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--", "./entrypoint.sh"]
