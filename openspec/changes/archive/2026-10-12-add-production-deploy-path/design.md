# Design

## Context

The API host (`apps/api`) already builds (`pnpm api:build`: `nest build`, `tsc-alias`, copy of generated Prisma clients and merged OpenAPI into `dist/`) and runs from compiled output (`api:start:prod`). Both Prisma services implement `onModuleDestroy`, but `main.ts` never calls `enableShutdownHooks()`, so the shutdown lifecycle is dead code. `prisma migrate deploy` exists only in the e2e global setup; `pnpm prisma:migrate` wraps `migrate dev` (a development tool). Only `libs/auth` and `libs/users` own a `migrations/` directory; `orders` connects to a database but owns none yet. Deployment target: nan.builders Spaces — apps build from a repository `Dockerfile` (path configurable per app), auto-deploy on push, expose one HTTP port, support runtime and build environment variables, and can run worker-mode apps; the PostgreSQL instance is itself an app in the same Space, reachable (per its connection string, `sslmode=require`) at a hostname that currently resolves only to cluster-internal addresses. The web client is a Vite SPA (`apps/web`), so its API base URL is fixed at build time.

See proposal.md for motivation; the delta specs define the observable behavior.

## Goals / Non-Goals

**Goals:**

- A container image per app (API, web) buildable from the repo by the platform, sharing one repository and one branch.
- Deploys that are self-migrating and idempotent, with a failed migration preventing traffic instead of serving it.
- Graceful termination wired to the existing lifecycle code.
- Release identification on every operational log entry, sourced from environment with a development fallback.
- A reproducible one-time provisioning step for the three service databases.

**Non-Goals:**

- Production email delivery (separate change; SMTP reachability from Apps is unverified).
- Multi-replica migration orchestration (single-replica deployments for now).
- Log shipping/transports (`production-log-transports` future feature), custom domains, staging environments, IaC.
- Any HTTP contract change or database schema change.

## Decisions

### 1. Migrations run in the container entrypoint, not as a separate job

The entrypoint applies `prisma migrate deploy` for each service that owns a `migrations/` directory (today: auth, users; orders is skipped until it owns one), then execs the API process. Rationale: the platform has no one-off job or release-command primitive; the default (and currently intended) replica count is 1, so concurrent migration runs cannot happen; `migrate deploy` is idempotent and only applies pending migrations. Alternatives rejected: a migration job in CI (the platform auto-deploys on push, so CI is not in the deploy path), running migrations manually from a laptop (the database is unreachable from outside the cluster), and auto-creating databases inside the entrypoint (hides provisioning, requires privileges a production app should not hold — database creation stays an explicit bootstrap step). Scaling beyond one replica requires moving migrations to a worker-mode app that runs before the API scales out; documented as a constraint, not built now.

### 2. Multi-stage images; the runtime image carries the Prisma CLI on purpose

API image: build stage installs dependencies (including dev), generates Prisma clients, runs `api:build`; runtime stage uses `node:26-alpine`, runs as a non-root user, and copies the compiled `dist/`, the per-service `prisma.config.ts`/schema/`migrations/` files, and the production dependency subset plus the Prisma CLI. The CLI is a devDependency but the entrypoint needs it at runtime for `migrate deploy` — an accepted image-size cost of in-container migrations. The generated Prisma clients already land inside `dist/` via `copy-prisma-clients.mjs`. Entrypoint runs under a small init process (tini) so signal delivery to Node is reliable regardless of how the platform's runtime handles PID 1. Web image: build stage runs the Vite build with the API base URL injected as a build-time variable; runtime stage is `nginx` serving the static output with `try_files ... /index.html` (SPA history fallback), long-lived immutable cache headers for hashed assets, and no-cache for `index.html`. `vite preview` was rejected as a runtime server; Caddy would serve equally well but nginx is the smaller, more familiar default here.

### 3. Graceful shutdown: enable the existing lifecycle, add nothing bespoke

`main.ts` gains `app.enableShutdownHooks()`; Nest then stops the listener on `SIGTERM`/`SIGINT`, completes in-flight requests, and runs the already-implemented `onModuleDestroy` hooks that disconnect the Prisma services. No custom drain timer in this change: in-flight work is short-lived HTTP handling, and a bespoke timeout would duplicate platform behavior we cannot yet observe (the platform's termination grace period is unknown — see Open Questions). nestjs-pino flushes on application shutdown; no extra flush wiring is added.

### 4. Build metadata: environment variables with a `dev` fallback

`logging.config.ts` extends the pino `base` with `version: APP_VERSION ?? 'dev'` and `commit: GIT_SHA ?? 'dev'`, so every entry carries release identification and unconfigured environments are honest (`dev`) rather than missing fields. Package.json version (`0.0.1`, static) and a generated `build-info.json` were rejected: they either misreport or add a build artifact to solve what an env var already solves. If the platform later proves to inject a commit SHA into builds, the same variables get wired to it without changing the design.

### 5. Cookie/domain shape: web and API under one registrable domain

Both apps deploy as subdomains of `apps.nan.builders`, whose registrable domain `nan.builders` is not on the Public Suffix List (verified during exploration), so the web and API origins are same-site: Better Auth's `SameSite=Lax` session cookie flows on cross-origin fetches without any cookie reconfiguration, and the API already treats configured trusted origins via `configureApp`. Constraint to preserve: the web and API origins must remain subdomains of one registrable domain; custom domains, if ever adopted, must follow the same sibling-subdomain shape.

### 6. Database bootstrap is a documented one-time step

The managed PostgreSQL instance hosts `auth_db`, `users_db`, and `orders_db` (matching the database-per-service design). Bootstrap is an explicit, once-per-environment provisioning step executed with access to the instance (inside the cluster or via a support-provided path), not an application side effect. Connection strings use `?schema=public&sslmode=require`. The instance is shared with another project; that operational coupling is accepted and noted.

## Namespace boundaries and layer placement

- `platform/production-runtime` (new): runtime behavior of the `apps/api` host across its modules — startup ordering with migrations and graceful termination. No `microservice.json`, no OpenAPI contract, no `--service platform` checks; repo-wide checks apply.
- `platform/observability-logging` (modified): the run-context requirement gains build metadata fields. Implementation touches `apps/api/src/platform/observability/logging.config.ts` only.
- `web/production-serving` (new): browser-observable serving behavior only. No backend contract is modified; the web client keeps referencing API endpoints as external contracts. No OpenAPI changes anywhere in this change.
- No `auth`/`users`/`orders` service code changes; migration application reuses each service's existing migration history.

## Migration Plan

1. (One-time, platform) Resolve/confirm DB access path with support; bootstrap `auth_db`, `users_db`, `orders_db` on the managed instance.
2. Create the API app: Dockerfile `docker/api/Dockerfile`, internal port `3000`, environment: the three `*_DATABASE_URL` values (`sslmode=require`), `AUTH_SECRET`, `AUTH_BASE_URL` (public API URL), `AUTH_WEB_URL`/`AUTH_TRUSTED_ORIGINS` (web origin), `APP_VERSION`, `GIT_SHA`, optional `LOG_LEVEL`. Deploy; the entrypoint's `migrate deploy` output in the first-build logs doubles as the cross-app connectivity smoke test.
3. Create the web app: Dockerfile `docker/web/Dockerfile`, internal port `80`, build variable `VITE_API_URL=<api origin>`. Deploy; verify a deep link and an authenticated round trip from the web origin.
4. Rollback: redeploy the previous commit from the platform (auto-deploy makes this a revert + push). Migrations are forward-only (`migrate deploy` never rolls back): schema changes on this and future changes must stay backward-compatible across one deploy window, and a rollback that crosses a migration re-introduces the previous image against a newer schema — acceptable because migrations are additive within this change (none) and future schema changes will state their rollback compatibility.

## Risks / Trade-offs

- [Apps in a Space may not reach each other over internal DNS] → First-deploy smoke test (step 2's migrate output); fallback is support guidance or explicitly exposing the DB, which changes only connection-string values, not the design. Rotate the DB credential already shared outside a secret store.
- [A failing migration blocks every subsequent deploy until fixed] → Desired behavior (no traffic on unmigrated schema); `migrate deploy` failure is loud in deploy logs; resolve forward with a corrected migration, never by hand-editing state.
- [Drain may exceed the platform's termination grace, cutting in-flight requests] → In-flight HTTP work is short; the unknown grace period is an open question — if the platform kills aggressively, a bounded drain timeout becomes a small follow-up, not a redesign.
- [Entrypoint migrations add startup latency to every container start/restart] → Idempotent no-op runs are fast; accepted in exchange for self-migrating deploys on a platform without release commands.
- [`VITE_API_URL` is baked at build time] → The API origin is stable per app slug; document that changing the API domain requires a web rebuild (redeploy).
- [Runtime image includes the Prisma CLI] → Larger image than strictly needed for serving; accepted so deploys stay self-migrating; revisiting only if a proper migration primitive appears.

## Open Questions

Answerable later without changing specs, approach, or task breakdown:

- Do Apps in the same Space reach each other over internal DNS? (Verified by the first API deploy's migration smoke test.)
- Is outbound SMTP allowed from Apps? (Only affects the future email-delivery change.)
- What is the supported path for administering the database from outside the cluster? (Bootstrap in this change runs inside or via support.)
- Does the platform inject the commit SHA into builds as a build argument or environment variable? (If yes, wire `GIT_SHA` automatically; the manual env fallback remains.)
- What termination grace period and readiness behavior does the platform apply? (Affects drain expectations only.)

All five are verified during the first real deployment and are tracked as the
`first-production-deployment` feature in `docs/future-features.json`: this
change ships the code, the local smoke harness
(`scripts/smoke-production-images.mjs`), and the runbook; the live platform
verification is operational work deliberately deferred to that moment.
