# Proposal

## Why

The repository has no CI: nothing verifies pushes or pull requests, so the only quality gates are local pre-commit hooks, which contributors can skip. The project is adopting a two-branch strategy (`develop` for integration, `master` for production) where `master` is protected and only accepts pull requests from `develop`. That strategy needs an automated gate on every PR to `develop` (fast, no infrastructure) and a stricter release gate on every PR to `master` (full suite, including end-to-end tests) so merges into `master` can be trusted.

## What Changes

- Add a GitHub Actions workflow (`.github/workflows/ci.yml`) with two tiers:
  - **Fast checks** on every PR targeting `develop` and every push to `develop`: lint (covers Prettier via `eslint-plugin-prettier`), architecture/domain validations, contract tests, unit tests, and production builds of the API and the web client. No external services required.
  - **Release gate** on every PR targeting `master` and every push to `master`: everything in the fast tier plus API end-to-end tests (Jest) against PostgreSQL service containers, and browser end-to-end tests (Playwright; the suite mocks backend calls, so it needs no database or live API).
- Pin the toolchain so CI matches local development: `packageManager` field in `package.json` (pnpm 11.10.0), `.nvmrc` (Node 26.5.0), and an `engines.node` guard.
- Align `nx.json` `defaultBase` with the integration branch (`develop`) instead of the nonexistent `main`.
- Establish the branch layout: create the `develop` branch and configure branch protection on `master` (pull-request-only merges with required status checks).

## Capabilities

### New Capabilities

- `platform/ci-pipeline`: Automated GitHub Actions pipeline for the repository: toolchain pinning, fast checks on integration PRs, and the full release gate (including end-to-end suites) on production-bound PRs and pushes to `master`.

### Modified Capabilities

- None. No existing spec covers repository CI or branch gating.

## Impact

- **Code/config**: new `.github/workflows/ci.yml`; edits to `package.json` (`packageManager`, `engines`), new `.nvmrc`, `nx.json` (`defaultBase`). No application or library runtime code changes.
- **Repositories/GitHub**: requires creating the `develop` branch and configuring `master` branch protection with required status checks (GitHub settings, applied manually or via `gh`).
- **Compatibility**: none of the changes affect the running API or web client. `packageManager` + `engines` may fail installs for contributors on older toolchains; this is intentional and matches local development (Node v26.5.0, pnpm 11.10.0).
- **Non-goals**: deployment to any environment, Docker image publishing, release/versioning automation, and migrating build/test orchestration to Nx targets with remote cache (tracked as `nx-task-executor-migration` in `docs/future-features.json`).
