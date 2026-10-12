# Design

## Context

The repository has no `.github/workflows/` and no CI history. Verification today is the husky pre-commit hook (`.husky/pre-commit`): `validate:architecture`, `validate:domain`, `check:domain-invariants`, `check:package-versions`, `test:contract`, `web:test --run` — all root `package.json` scripts orchestrated by `scripts/cli.ts`. Notably, API unit tests (`api:test`) and all builds are not in the hook. The repo is on `master` (GitHub default branch) and is adopting `develop` as the integration branch (see proposal.md - Why).

Facts that shape the approach (verified in the codebase):

- Local toolchain: Node v26.5.0, pnpm 11.10.0. `package.json` has no `packageManager` or `engines` field and there is no `.nvmrc`.
- pnpm pre-scripts (`pretest:contract`, `preapi:test`, `preapi:build`, ...) run `prisma:generate` automatically, so invoking the top-level scripts suffices; Prisma codegen needs no database.
- API unit tests (`api:test`) run Jest on `apps/**` and `libs/**`, excluding both e2e directories; no service containers observed as required. API e2e (`api:test:e2e`, config in `apps/api-e2e/`) expects PostgreSQL with disposable databases `users_test_db` and `auth_test_db` (`.env.example` states they are created and migrated automatically by the suite).
- Browser e2e (`web:e2e`, `apps/web-e2e/playwright.config.ts`) mocks backend calls with `page.route` — no database, email, or live API. It starts its own Vite server on port 4300 with `strictPort`, `reuseExistingServer: !process.env.CI`, `retries: 2` in CI, and a chromium-only project.
- Postgres version parity: `docker-compose.yml` uses `postgres:16-alpine` and `docker/postgres/init-databases.sh` creates the five databases.
- `nx.json` `defaultBase` is `"main"`, which matches no branch. Nx is used as a project map (tags, module boundaries) with no executable targets, so `nx affected` and remote cache are out of scope (tracked in `docs/future-features.json` as `nx-task-executor-migration`).
- Lint already enforces formatting via `eslint-plugin-prettier` (`prettier/prettier: error`), so a separate Prettier check is redundant.

Namespace scope: `platform` only — cross-cutting repository behavior, no microservice.json, no OpenAPI contract, no `--service platform` checks. No backend contract is modified, and the browser e2e suite stays free of database, email, and live API dependencies.

## Goals / Non-Goals

**Goals:**

- One workflow file that serves both gates (fast tier and release gate) with stable, requirable check names: `checks`, `e2e-api`, `e2e-web`.
- CI toolchain identical to local: Node and pnpm read from repository-pinned sources, frozen lockfile install.
- Release gate provisions only what the suites actually need: PostgreSQL for API e2e, Playwright browsers for web e2e.
- Fast feedback: fast tier in one job, minutes not tens of minutes, with pnpm store caching.

**Non-Goals:**

- Deployment, Docker image publishing, release/tag automation.
- Migrating orchestration to Nx targets, `nx affected`, or remote cache.
- Splitting the fast tier into per-check parallel jobs (single job is sufficient at this repo size; revisit when the suite grows).
- Protecting `develop` (only `master` protection is in scope; `develop` protection can be added later with the same mechanics).

## Decisions

**D1. Single workflow with conditionally-run jobs (over reusable workflows or two files).**
`.github/workflows/ci.yml` triggers on `pull_request` targeting `develop` or `master` and `push` to `develop` or `master`. The fast-tier job `checks` always runs; `e2e-api` and `e2e-web` run only when the event targets `master` (for `pull_request`: `github.event.pull_request.base.ref == 'master'`; for `push`: `github.ref == 'refs/heads/master'`).
- Alternatives: (a) two workflow files — duplicates setup steps; (b) a reusable workflow invoked by two wrappers — cleaner at scale but premature for three jobs. Decision favors the smallest structure that satisfies the spec; extracting a reusable workflow later is mechanical.

**D2. Toolchain pinning via repository fields, not workflow values.**
`package.json` gains `"packageManager": "pnpm@11.10.0"` and `"engines": { "node": ">=26" }`; `.nvmrc` contains `26.5.0`. In CI: `pnpm/action-setup@v4` (reads the `packageManager` field, no version hardcoded) then `actions/setup-node@v4` with `node-version-file: .nvmrc` and `cache: pnpm` — in that order, since the cache requires pnpm installed. Install runs `pnpm install --frozen-lockfile`.
- Alternative rejected: corepack. Node removed it from the distribution starting with Node 25; this repo runs Node 26. `pnpm/action-setup` is the current standard path.

**D3. Fast tier mirrors the pre-commit hook plus what the hook omits.**
Job `checks` runs sequentially: `pnpm lint` → `pnpm validate:architecture` → `pnpm validate:domain` → `pnpm check:domain-invariants` → `pnpm check:package-versions` → `pnpm test:contract` → `pnpm api:test` → `pnpm web:test --run` → `pnpm api:build` → `pnpm web:build`. API unit tests and both builds extend the pre-commit set because CI is the only place every contributor's code is verified identically.
- Alternative: parallel jobs per check for granular required checks and faster wall time. Deferred — the suite is small; one job keeps the workflow trivial and the required-check list short.

**D4. API e2e uses a Postgres service container initialized by the existing script.**
Job `e2e-api` declares a `postgres:16-alpine` service (matching compose parity) that mounts `docker/postgres/init-databases.sh`, then runs `pnpm api:test:e2e` with the test-database URLs pointing at `127.0.0.1:5432` (`USERS_TEST_DATABASE_URL`, `AUTH_TEST_DATABASE_URL`) and a dummy `AUTH_SECRET` — mirroring `.env.example`. The suite creates and migrates the disposable databases itself.
- Alternative rejected: running compose — heavier and designed for development, not CI.
- Fallback if the init script misbehaves under the service container: inline `psql` commands creating the five databases (same names as compose).

**D5. Web e2e leans on the suite's existing CI posture.**
Job `e2e-web` installs the chromium browser (`pnpm exec playwright install --with-deps chromium`) and runs `pnpm web:e2e`. The config already provides CI behavior: fresh server via `strictPort`, `reuseExistingServer: false` under `CI`, retries, and mocked backend calls — so this job needs no services.

**D6. Check names are the job names; runs are deduplicated and bounded.**
Job IDs `checks`, `e2e-api`, `e2e-web` are the stable names required by the spec and by `master` branch protection. The workflow sets `concurrency` per PR ref (cancel in-progress superseded runs) and explicit `timeout-minutes` per job.

**D7. Branch setup and protection are repository operations, not workflow code.**
Apply creates the `develop` branch and configures `master` protection (require pull request, required checks `e2e-api` + `e2e-web`, linear history optional) via GitHub settings or `gh api`. This cannot live in the workflow file and is called out as an explicit task with verification.

## Risks / Trade-offs

- [API unit or e2e tests need env vars beyond the documented ones] → Verify locally with a minimal environment mirroring `.env.example` before wiring the jobs; add only the missing variables to the job env, never real secrets.
- [Postgres init script incompatibility under the service container] → D4 fallback with inline `psql` database creation.
- [Playwright flakiness in CI] → Already mitigated by config (2 retries, trace on first retry, chromium-only); if a spec proves unstable it is fixed as a test bug, not by loosening the gate.
- [Ubuntu runners vs Windows dev machine drift] → All checks are Node-based and cross-platform; the risk is low, and CI on Linux is the reference environment for deployment.
- [pnpm store cache misses on lockfile changes] → Accepted cost; cache is keyed on `pnpm-lock.yaml`.
- [Rollback] → The workflow file is additive; deleting it (or disabling the workflow) reverts to pre-commit-only gating. Branch protection can be relaxed independently at any time.

## Open Questions

None. Playwright in the release gate from day one was explicitly approved during exploration; if it proves unstable in practice, demoting `e2e-web` to a follow-up is a scope decision to revisit then, not now.
