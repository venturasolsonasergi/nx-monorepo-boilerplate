# Proposal: add-production-deploy-path

## Why

The repository has a complete development workflow (compose, `Dockerfile.dev`, e2e suites that self-migrate disposable databases) but no path to production: there is no production image, the API process never enables shutdown hooks (so the existing `onModuleDestroy` handlers in the Prisma services never run), and `prisma migrate deploy` exists only inside the e2e global setup. The first real deployment — planned on nan.builders Spaces, which builds apps from a repository `Dockerfile` and serves the database from another app in the same Space — will hit every one of these gaps at once. Additionally, operational logs carry no build/version metadata: the structured-logging change explicitly deferred version fields until a source was defined, and a deployment needs them to correlate log output with releases.

## What Changes

- Add a production API image (`docker/api/Dockerfile`, multi-stage): build stage compiles `dist/` with generated Prisma clients; runtime stage runs Node on Alpine with production dependencies only, as a non-root user, taking its listen port from `PORT`.
- Add a container entrypoint that applies pending migrations with `prisma migrate deploy` for every service that owns migrations (auth, users) before starting the API process, so a deploy is self-migrating and idempotent.
- Enable graceful shutdown in `apps/api/src/main.ts` (`enableShutdownHooks()`): on `SIGTERM`/`SIGINT` the process stops accepting new requests, finishes in-flight requests, and closes Prisma connections through the existing lifecycle hooks.
- Add build/version metadata to every operational log entry: `version` and `commit` read from environment (`APP_VERSION`, `GIT_SHA`) with a `dev` fallback, extending the existing pino `base` fields. This retires the deferred checklist item "add build/version metadata when its source is defined" in `docs/future-features.json`.
- Add a production web image (`docker/web/Dockerfile`): Vite build stage plus an nginx runtime serving the static client with SPA history fallback, with the API base URL injected at build time.
- Document the production environment: a production `.env.example` (database URLs with `sslmode=require`, `AUTH_SECRET`, `AUTH_BASE_URL`, trusted origins, `APP_VERSION`, `GIT_SHA`, `LOG_LEVEL`) and a one-time bootstrap procedure that creates `auth_db`, `users_db`, and `orders_db` on the managed PostgreSQL instance.

## Capabilities

### New Capabilities

- `platform/production-runtime`: cross-cutting runtime behavior of the API host in production — starting after pending migrations are applied, and stopping gracefully on termination signals without cutting in-flight requests or leaking database connections.
- `web/production-serving`: browser-observable serving behavior of the built client — the client is served from its own origin over HTTPS and direct navigation to any client route (deep links, refreshes) renders the app instead of an error.

### Modified Capabilities

- `platform/observability-logging`: the run-context requirement gains build/version identification — entries carry `version` and `commit` fields sourced from the environment with a development fallback, so every log record identifies the release that emitted it.

## Impact

- **Code**: `apps/api/src/main.ts`, `apps/api/src/platform/observability/logging.config.ts` (+ its tests), new `docker/api/Dockerfile`, new `docker/web/Dockerfile` (+ nginx config), possibly a small script to enumerate per-service `migrate deploy` invocations, `.env.example`, `docs/future-features.json`.
- **Contracts**: no HTTP contract changes in any `libs/<service>/specs/openapi.yaml`; no database schema changes.
- **Compatibility**: new environment variables are optional with development fallbacks; the local dev workflow (compose, `Dockerfile.dev`, `tsx watch`) is unchanged. Existing log entries keep their current fields; the new fields are additive.
- **Deployment target**: any platform that builds from a repository `Dockerfile` (the chosen target, nan.builders Spaces, builds images from the repo and auto-deploys on push; the API connects to the database and the built web client runs as a sibling app). Platform-specific behaviors that are still unverified are recorded as open questions in design.md and verified during the first deployment — they do not change this design.
- **Non-goals**: production email delivery (separate change, pending SMTP verification), CI-driven deploy steps (the platform auto-deploys on push), multi-replica migration orchestration, log shipping/transports (existing `production-log-transports` future feature), custom domains, staging environment, infrastructure-as-code.
