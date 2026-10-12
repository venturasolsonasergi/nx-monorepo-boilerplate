# ci-pipeline Specification

## Purpose

Automated GitHub Actions pipeline for the repository: it pins the toolchain, runs a fast verification suite on every integration change, and runs the full release gate (including end-to-end suites) on production-bound changes, so `master` merges are trustworthy and protected.

## Requirements

### Requirement: Pinned toolchain

The pipeline SHALL run Node.js and pnpm at the exact versions pinned in the repository (`.nvmrc` and the `packageManager` field of `package.json`) and SHALL install dependencies from the lockfile in frozen mode. The pipeline MUST NOT resolve toolchain versions independently of the repository.

#### Scenario: Workflow uses the pinned toolchain

- **WHEN** any pipeline run starts on any branch or event
- **THEN** Node.js and pnpm versions match `.nvmrc` and the `packageManager` field respectively, without hardcoded versions in the workflow file

#### Scenario: Out-of-sync lockfile is rejected

- **WHEN** `pnpm-lock.yaml` does not match the manifests in `package.json`
- **THEN** dependency installation fails and the run is reported as failed

### Requirement: Fast checks on integration changes

Every pull request targeting `develop` and every push to `develop` SHALL run, without requiring external services such as databases or mail servers:

- repository lint (which includes formatting enforcement),
- architecture, domain-purity, domain-invariant, and package-version validations,
- contract tests,
- unit tests of the API and the web client,
- production builds of the API and the web client.

A run SHALL succeed only when all of these checks pass.

#### Scenario: Pull request to develop runs the fast tier

- **WHEN** a pull request targeting `develop` is opened or updated
- **THEN** the pipeline runs lint, architecture validations, contract tests, unit tests, and builds, and reports one verifiable result per run

#### Scenario: Fast check failure fails the run

- **WHEN** any fast-tier check fails (for example, a unit test fails on the PR head commit)
- **THEN** the run is reported as failed and the failing check is visible on the pull request

### Requirement: Release gate on production-bound changes

Every pull request targeting `master` and every push to `master` SHALL run the full fast tier from the merged or pushed commit, plus:

- API end-to-end tests executed against PostgreSQL databases provisioned for the run (including the disposable test databases the suite expects),
- browser end-to-end tests executed in a headless browser, with the web server started by the test runner.

A run SHALL succeed only when all checks pass, so a green run on `master` certifies the exact commit that will be deployed.

#### Scenario: Pull request develop to master runs the release gate

- **WHEN** a pull request targeting `master` is opened or updated
- **THEN** the pipeline runs the fast tier plus the API end-to-end suite with PostgreSQL and the browser end-to-end suite

#### Scenario: End-to-end failure blocks the release

- **WHEN** any end-to-end test fails on a pull request targeting `master`
- **THEN** the run is reported as failed and the pull request cannot be merged while that check is required

### Requirement: Stable, requirable check results

The pipeline SHALL report each tier's outcome as stable, nameable check results (consistent across runs and branches), so branch protection on `master` can require the release-gate checks and, where desired, the fast-tier checks on `develop`.

#### Scenario: Check names are stable for branch protection

- **WHEN** branch protection for `master` is configured with the pipeline's release-gate check names as required status checks
- **THEN** every pull request from `develop` to `master` reports exactly those checks, and the merge is blocked until all of them pass

#### Scenario: Push to master revalidates the merged commit

- **WHEN** a pull request from `develop` is merged into `master`
- **THEN** the pipeline runs the release gate again on the merge commit and reports the same named checks
