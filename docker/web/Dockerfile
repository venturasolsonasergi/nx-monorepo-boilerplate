# Production image for the web client (apps/web), multi-stage per
# openspec/changes/add-production-deploy-path/design.md decision 2.
# Build context is the repository root: docker build -f docker/web/Dockerfile .
#
# VITE_API_URL is injected at build time; changing the API origin later
# requires a web rebuild/redeploy.

ARG PNPM_VERSION=11.10.0

# ---------------------------------------------------------------------------
# Build stage: install dependencies and run the Vite build with the API base
# URL injected as a build-time variable.
# ---------------------------------------------------------------------------
FROM node:26-alpine AS build
ARG PNPM_VERSION
ARG VITE_API_URL=""
WORKDIR /app
ENV VITE_API_URL=${VITE_API_URL}

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.json tsconfig.base.json ./
RUN npm install -g "pnpm@${PNPM_VERSION}" && pnpm install --frozen-lockfile

COPY apps/ ./apps/
COPY libs/ ./libs/

RUN pnpm web:build

# ---------------------------------------------------------------------------
# Runtime stage: nginx serving the static client with SPA history fallback.
# ---------------------------------------------------------------------------
FROM nginx:1.29-alpine AS runtime
COPY docker/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/apps/web /usr/share/nginx/html

EXPOSE 80
