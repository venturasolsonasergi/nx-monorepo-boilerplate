# SDD Flow

OpenSpec manages change proposals, behavior requirements, implementation tasks,
and archival. OpenAPI remains the HTTP contract for each service under
`libs/<service>/specs/openapi.yaml`. The React browser client (`apps/web`) is a
product surface recorded under the `web` namespace; it is not a microservice and
has no OpenAPI contract. The repository's architecture validators and tests
complement OpenSpec; they are not replaced by it.

OpenSpec artifacts live at the monorepo root:

```text
openspec/
  config.yaml
  specs/<namespace>/<capability>/spec.md
  changes/<change>/
  changes/archive/<date>-<change>/
```

A namespace is either a discovered microservice (`libs/<service>/microservice.json`)
or the browser client `web`. Each change delta uses the same
`<namespace>/<capability>` path as its persistent spec. This keeps a namespace's
requirements together for later extraction while allowing one change to cover
several namespaces.

## Setup

Use Node.js 20.19 or newer. Install the CLI globally and initialize/update the
project workflows from the repository root:

```powershell
npm install -g @fission-ai/openspec@latest
openspec init --tools "github-copilot,claude,opencode" --profile custom --language English --no-copilot-cloud
openspec update
```

The `verify` workflow is optional. Each developer's global OpenSpec profile must
include the core workflows plus `verify`, with delivery set to `both`; the
generated project skills/commands are committed in this repository. OpenSpec's
global profile is machine-wide, so changing it also affects future OpenSpec
projects on that machine.

Beyond the generated `/opsx-*` workflows, the repository keeps a small set of
helper prompts for actions those workflows do not cover. They are documented
here and referenced by `/sdd`:

- `/sync-openapi` — synchronize an approved backend delta into its
  `libs/<service>/specs/openapi.yaml` (Phase 1).
- `/repo-checks` — run the executable service/OpenAPI and repo-wide checks
  (Phase 2); distinct from the report-only `/opsx-verify`.
- `/code-review` — run final checks and prepare the commit summary (Phase 3).

## Phase 1: Draft and Validate

1. Use `/opsx-explore` if scope or behavior is unclear.
2. Use `/opsx-propose` to create `proposal.md`, capability delta specs,
   `design.md` when needed, and `tasks.md`.
3. For browser, email, or external-provider flows, review the complete
   observable path: start, return URL, cookies/state, redirect destination,
   failure behavior, and any client route needed. Give each cross-boundary
   task a host-level test that follows the return path; a mocked callback or
   authorization URL alone does not demonstrate completion. Review the
   requirements and tasks with the user. Do not implement before they
   explicitly approve the plan.
4. Use `/sync-openapi` to synchronize each affected backend service's
   `libs/<service>/specs/openapi.yaml` from the approved delta, then validate the
   change and each affected backend HTTP contract. A change that only touches the
   `web` namespace has no OpenAPI contract to validate:

```powershell
openspec validate <change>
pnpm run validate:openapi -- --service <service>   # only for affected backend services
```

GitHub Copilot and OpenCode invoke `/opsx-propose`; Claude Code invokes
`/opsx:propose`. The same tool-specific spelling applies to explore, apply,
verify, and archive.

**Exit gate:** the proposal's namespace/capability scope is explicit, all behavior
has testable scenarios, OpenSpec validation passes, any affected backend OpenAPI
validates, and the user approves the artifacts.

## Phase 2: Implement and Test

1. Start a fresh implementation session and use `/opsx-apply` (Claude:
   `/opsx:apply`) for the approved change. Complete and verify each task before
   checking it off.
2. Run tests scoped to each changed service and keep repository architecture
   checks global. Use `/repo-checks` to run the executable checks for the
   affected services:

```powershell
pnpm run validate:openapi -- --service <service>
pnpm run verify -- --service <service>
```

`verify` runs architecture, domain-purity, invariant, dependency, and the
service-scoped contract checks. The optional `--service` scopes contract tests
only; architecture and dependency validation still covers the monorepo, so no
separate `test:contract` call is needed. Run API e2e tests whenever a
change crosses an HTTP host, browser, email-link, cookie, or provider callback
boundary. A local provider/mail substitute can complete these flows without
production credentials:

```powershell
pnpm run api:test:e2e -- --runInBand
```

Run `pnpm run verify` plus `pnpm web:test`, `pnpm web:build`, and `pnpm web:e2e`
when the client changes; `verify` keeps the architecture, domain purity,
invariant, and dependency checks repo-wide for the `web` namespace too, and the
`web` namespace has no OpenAPI or service-scoped contract checks. Keep the
browser checks out of `.husky/pre-commit` so browser e2e does not run on every
commit. `web:e2e` is Playwright smoke coverage of the implemented routes
and states; it needs no database, email, or live API. If a redirect targets an
unimplemented client route outside the approved scope, record it as a release
dependency, not as a working end-to-end user journey.

3. Run `/opsx-verify` (Claude: `/opsx:verify`) for a report-only comparison of
   implementation against the change artifacts. It does not replace executable
   tests. Resolve any behavior mismatch by updating/reviewing the artifacts
   before changing implementation.

**Exit gate:** all tasks are checked, service tests (plus `web:test`,
`web:build`, and `web:e2e` for web changes) and required repo-wide checks pass,
any affected backend OpenAPI validates, and OpenSpec verification has no
unresolved critical mismatch. For cross-boundary flows, record which scenario is covered
by which executable host-level test and whether any external or client
dependency remains unverified; do not mark a flow complete on green mocks alone.

## Phase 3: Archive and Prepare Commit

1. Use `/opsx-archive` (Claude: `/opsx:archive`) only after Phase 2 passes.
   Review the merge into `openspec/specs/<namespace>/<capability>/spec.md` and
   confirm the change is moved to `openspec/changes/archive/`.
2. Run `openspec validate --all` and `git diff --check`; review the code and
   archived artifacts together.
3. Prepare a conventional commit summary that identifies the affected
   namespace(s) and change. Do not commit, tag, or push automatically; the user
   performs the Git operation after reviewing the diff.

## Service Extraction

When extracting a service to another repository, take its `libs/<service>/`
directory, including `specs/openapi.yaml`, `microservice.json`, Prisma schema
and migrations, tests, and `project.json`. Also take
`openspec/specs/<service>/`. Review imports and metadata for references to
`libs/shared/`, Nx aliases, root scripts, and dependencies; bring those along or
replace them with standalone equivalents. OpenSpec proposals and archived
changes are repository history, not part of an individual service export. The
`web` namespace and `apps/web` are the product surface and are not extracted as
a service.

The OpenSpec CLI and tool integrations are installed/configured separately on
each developer machine. Project configuration and generated tool workflow files
are committed with the monorepo.
