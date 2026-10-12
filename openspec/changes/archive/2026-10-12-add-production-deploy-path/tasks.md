# Tasks

## 1. Build metadata in operational logs (platform)

- [x] 1.1 (platform) Extend `apps/api/src/platform/observability/logging.config.ts`: add `version` (`APP_VERSION ?? 'dev'`) and `commit` (`GIT_SHA ?? 'dev'`) to the pino `base` fields and the optional fields to `LoggerEnvironment`; extend `logging.config.spec.ts` with cases for configured values, unset fallbacks, and mixed configuration. Verify: `pnpm api:test -- logging.config` passes with the new scenarios.
- [x] 1.2 (platform) Update `docs/future-features.json`: mark the structured-logging checklist item "add build/version metadata" as covered (no longer deferred), referencing this change. Verify: `node -e "JSON.parse(require('fs').readFileSync('docs/future-features.json'))"` succeeds and the checklist no longer lists version metadata as deferred.

## 2. Graceful shutdown (platform)

- [x] 2.1 (platform) Enable shutdown lifecycle in `apps/api/src/main.ts` (`app.enableShutdownHooks()` before listening) so the existing Prisma `onModuleDestroy` handlers run on `SIGTERM`/`SIGINT`. Verify: `pnpm api:test` passes unchanged, and locally `pnpm api:start` followed by a `SIGTERM` exits cleanly after stopping the listener (no hanging process, no open DB connections reported).

## 3. API production image and self-migrating entrypoint (platform)

- [x] 3.1 (platform) Add a root `.dockerignore` excluding `node_modules`, `dist`, `.git`, `coverage`, `archive`, and generated clients so the build context is source-only. Verify: `docker build` context no longer stages those directories (inspect with `docker build --progress=plain` output).
- [x] 3.2 (platform) Author `docker/api/Dockerfile` (multi-stage per design decision 2): build stage installs dependencies (frozen lockfile), generates Prisma clients, runs `pnpm api:build`; runtime stage on `node:26-alpine`, non-root user, tini init, copying `dist/`, the per-service `prisma.config.ts`/schema/`migrations/` files, and the production dependency subset plus the Prisma CLI; `EXPOSE 3000`, `PORT`-driven listen. Verify: `docker build -f docker/api/Dockerfile .` succeeds and `docker run` with `NODE_ENV=production` plus the three `*_DATABASE_URL` values against the local compose Postgres reaches `API listening on port 3000`.
- [x] 3.3 (platform) Author `docker/api/entrypoint.sh`: run `prisma migrate deploy` for each service owning a `migrations/` directory (auth, users) against its config, abort startup on failure, then exec the API process. Verify: against freshly created local `auth_db`/`users_db` the image applies migrations before serving (deploy output precedes the listening log), and a second start applies nothing (idempotent) while still serving.
- [x] 3.4 (platform) Document the production environment: production variables in `.env.example` (three `*_DATABASE_URL` with `?schema=public&sslmode=require`, `AUTH_SECRET`, `AUTH_BASE_URL`, `AUTH_WEB_URL`, `AUTH_TRUSTED_ORIGINS`, `APP_VERSION`, `GIT_SHA`, `LOG_LEVEL`, `PORT`) and a deployment runbook (new `docs/deployment.md`) covering the database bootstrap (`CREATE DATABASE auth_db`/`users_db`/`orders_db` on the managed instance), app creation, environment variables, first-deploy smoke test, and rollback. Verify: the documented bootstrap commands run against the local compose Postgres, and the runbook's env var list matches `.env.example` line by line.

## 4. Web production image (web)

- [x] 4.1 (web) Author `docker/web/Dockerfile` plus its nginx config (multi-stage per design decision 2): build stage runs the Vite build with `VITE_API_URL` injected as a build variable; runtime stage serves the static output with SPA history fallback (`try_files ... /index.html`), immutable cache headers for hashed assets, no-cache for `index.html`, port `80`. Verify: `docker build -f docker/web/Dockerfile .` succeeds and the running container answers `/` and a deep-linked client route with the built HTML shell (200) while a hashed asset path returns the asset file itself.
- [x] 4.2 (web) Confirm the client build is unaffected by the serving packaging. Verify: `pnpm web:test` and `pnpm web:build` pass.

## 5. First production deployment (platform, external integration)

Deferred to the first real deployment of a project derived from this
boilerplate: it is operational work on a live platform, not code this change
ships. The steps, environment, smoke test, and rollback remain documented in
`docs/deployment.md`, and the local equivalents of the container scenarios are
automated by `scripts/smoke-production-images.mjs` (requires Docker and the
compose Postgres). The pending platform verifications — cross-app DNS
visibility, `migrate deploy` in deploy logs, public health check, same-site
sign-in round trip, and `version`/`commit` fields in platform logs — are
tracked as the `first-production-deployment` feature in
`docs/future-features.json`.

## 6. Repo-wide integration checks (final)

- [x] 6.1 (platform) Run the repo-wide gates the platform namespace requires: `pnpm lint`, `pnpm run verify`, and `openspec validate add-production-deploy-path --strict`. Verify: all three pass.
- [x] 6.2 (web) Run `pnpm web:e2e` to confirm the production-serving work did not disturb browser flows. Verify: the Playwright suite passes.

## 7. Review follow-ups (post-implementation review)

- [x] 7.1 (platform) Replace the hardcoded service list in `docker/api/entrypoint.sh` with discovery by migrations ownership (glob over `/app/libs/*/infrastructure/prisma/migrations`), failing loudly when a service owns migrations but its `prisma.config.ts` is missing from the image. Re-verified against fresh databases: migrations apply before serving, SIGTERM stop is clean, restart is idempotent.
- [x] 7.2 (platform) Delimit the production section of `.env.example` with an explicit warning that appending it to a development `.env` lets the later production values silently override the earlier development ones (dotenv last-value-wins). Variable list unchanged, so the runbook line-by-line match is preserved.
- [x] 7.3 (platform) Add an automated smoke suite for the production images (`scripts/smoke-production-images.mjs`, `pnpm docker:smoke`) covering the previously manual-only scenarios: failed migration prevents startup, pending migrations apply before serving, graceful SIGTERM shutdown with every smoke-database connection closed, idempotent restart without pending migrations, and web SPA fallback with immutable asset caching and no-cache HTML. Requires Docker and the compose Postgres. Verify: `pnpm docker:smoke` passes end to end.
