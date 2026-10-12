# Tasks

## 1. Toolchain pinning (platform)

- [x] 1.1 (platform) Add `"packageManager": "pnpm@11.10.0"` and `"engines": { "node": ">=26" }` to `package.json`; verify `pnpm install` still succeeds locally with the current toolchain.
- [x] 1.2 (platform) Add `.nvmrc` containing `26.5.0`; verify the pinned version matches the local runtime (`node -v`).
- [x] 1.3 (platform) Change `nx.json` `defaultBase` from `main` to `develop`; verify the file is valid JSON (`node -e "JSON.parse(require('fs').readFileSync('nx.json'))"`).

## 2. Fast-tier workflow (platform)

- [x] 2.1 (platform) Create `.github/workflows/ci.yml` skeleton: name, triggers on `pull_request` targeting `develop`/`master` and `push` to `develop`/`master`, per-PR `concurrency` group with cancel-in-progress, `pnpm/action-setup@v4` followed by `actions/setup-node@v4` with `node-version-file: .nvmrc` and `cache: pnpm`, and `pnpm install --frozen-lockfile`; verify the file is valid YAML and the trigger branch list matches the two-branch strategy.
- [x] 2.2 (platform) Implement the `checks` job with an explicit `timeout-minutes`, generating the Prisma clients first (they are gitignored and absent on a fresh checkout), then running in order: `pnpm lint`, `pnpm validate:architecture`, `pnpm validate:domain`, `pnpm check:domain-invariants`, `pnpm check:package-versions`, `pnpm test:contract`, `pnpm api:test`, `pnpm web:test --run`, `pnpm api:build`, `pnpm web:build`; verify each command passes locally when run in that order from a clean state.
- [x] 2.3 (platform) Confirm no fast-tier step requires a running external service: the job declares no service containers and no secret references; the only database values are localhost placeholder URLs that exist solely so `prisma.config.ts` can resolve at generate time, and no step connects to them.

## 3. Release-gate jobs (platform)

- [x] 3.1 (platform) Add the `e2e-api` job, gated to run only when the event targets `master` (`pull_request.base.ref == 'master'` or `push` to `refs/heads/master`), with a `postgres:16-alpine` service container (no init-script mount: service containers start before checkout, and the suite's global setup creates and migrates the disposable `users_test_db`/`auth_test_db` itself), env for `USERS_TEST_DATABASE_URL`, `AUTH_TEST_DATABASE_URL` (pointing at `127.0.0.1:5432`), placeholder `AUTH_DATABASE_URL`/`USERS_DATABASE_URL`/`ORDERS_DATABASE_URL` (resolved by `prisma:generate`) and a dummy `AUTH_SECRET`, running `pnpm api:test:e2e`; verify locally by dropping the test databases and running `pnpm api:test:e2e` with the same env values until green.
- [x] 3.2 (platform) Add the `e2e-web` job with the same `master` gating, running `pnpm exec playwright install --with-deps chromium` then `pnpm web:e2e`; verify locally with `CI=true pnpm web:e2e` (fresh server on port 4300, no reuse, no backend needed) until green.
- [x] 3.3 (platform) Verify the gating conditions: a review of the workflow shows `e2e-api` and `e2e-web` cannot run for events targeting `develop` (e.g., during the task-5.1 PR the two jobs are absent or skipped).

## 4. Branch layout and protection (platform)

- [x] 4.1 (platform) Create the `develop` branch from `master` and push it; verify with `git ls-remote --heads origin develop`.
- [ ] 4.2 (platform) Configure `master` branch protection: require pull requests, require status checks `e2e-api` and `e2e-web` (plus `checks` if desired); verify the rule appears via `gh api repos/{owner}/{repo}/branches/master/protection` or the Settings > Branches UI.

## 5. Integration verification (platform)

- [ ] 5.1 (platform) Push the workflow, open a feature-branch PR into `develop`, and observe the run: `checks` executes the full fast tier and passes; verify the run is green on the PR.
- [ ] 5.2 (platform) Open a `develop` → `master` PR and observe the run: `checks`, `e2e-api`, and `e2e-web` all execute and pass; verify all required checks are green and the merge is permitted only then.
- [x] 5.3 (platform) Run repo-wide gates after the toolchain changes: `pnpm lint`, `pnpm run verify`, and `openspec validate add-github-actions-ci`; verify all three pass.
