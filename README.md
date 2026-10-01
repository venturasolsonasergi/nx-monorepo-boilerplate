# NestJS SDD Microservices Boilerplate

Backend boilerplate for microservices with:

- Spec Driven Development (SDD)
- OpenSpec for behavioral requirements and change history
- OpenAPI as the HTTP contract for each service
- legacy lidr-specboot metadata placeholders
- Tactical DDD and clean architecture lite
- Prisma repositories in infrastructure
- Architecture validation harness

## Project Structure

- `apps/api/` NestJS API application and `apps/web/` React application
- `apps/api-e2e/` end-to-end tests for the API
- `libs/users/` and `libs/orders/` service modules:
  - `specs/openapi.yaml`, `specs/context/`, `domain/`, `application/`, `infrastructure/`, `tests/`
- `openspec/specs/<service>/<capability>/spec.md` — persistent behavioral specs, namespaced for service extraction
- `openspec/changes/` — proposed changes and archive history
- `libs/shared/domain/`, `libs/shared/validation/`, and `libs/shared/api-contracts/`
- `architecture/` rules, graph and validation engine
- `scripts/` root workflow scripts

## Application Commands

- `pnpm api:start:dev` — start the API in watch mode
- `pnpm api:build` — build the API and package its generated Prisma clients
- `pnpm api:test` — run API unit and contract tests
- `pnpm api:test:e2e` — run API end-to-end tests
- `pnpm web:dev` — start the React app in Vite
- `pnpm web:build` — build the React app

## Core Commands

- `pnpm run validate:openapi` — validate all discovered service contracts
- `pnpm run validate:openapi -- --service orders` — validate one service contract
- `pnpm run validate:architecture`
- `pnpm run validate:domain`
- `pnpm run check:domain-invariants`
- `pnpm run check:dependencies`
- `pnpm run test:contract -- --service orders` — run one service's contract tests
- `pnpm run test:contract` — run contract tests for all discovered services

## Database Commands (Prisma)

Prisma commands are service-agnostic: they discover every service with a
`microservice.json` and use its
`libs/<service>/infrastructure/prisma/prisma.config.ts`. There are no per-service
scripts to maintain.

- `pnpm prisma:generate` — generate the Prisma client for all discovered services (services without a `prisma.config.ts` are skipped)
- `pnpm prisma:generate -- --service users` — generate one service's client
- `pnpm prisma:migrate -- --service users -- --name add_status` — run `prisma migrate dev` for one service

For `prisma:migrate`, `--service` is mandatory and any argument after the second
`--` is forwarded verbatim to the Prisma CLI.

`prisma:generate` already runs as a `pre*` hook of the build, start, test,
`verify` and `test:contract` scripts, so you rarely need to invoke it by hand.

## OpenSpec Workflow

Install Node.js 20.19 or newer and the OpenSpec CLI, then initialize the project
workflows from the repository root:

```powershell
npm install -g @fission-ai/openspec@latest
openspec init --tools "github-copilot,claude,opencode" --profile custom --language English --no-copilot-cloud
openspec update
```

The machine-wide OpenSpec profile must include the core workflows plus optional
`verify`, with delivery set to `both`. The workflow is split into three gated
phases; see [docs/sdd-flow.md](docs/sdd-flow.md) for commands and exit criteria.

1. Draft and validate: `/opsx-explore` when needed, `/opsx-propose`, review, sync the affected OpenAPI contract, then validate.
2. Implement and test: `/opsx-apply`, service-scoped tests and repo-wide checks, then `/opsx-verify`.
3. Archive and prepare commit: `/opsx-archive`, review the synced specs and diff; the user commits manually.

GitHub Copilot and OpenCode use `/opsx-propose`; Claude Code uses `/opsx:propose`.

`pnpm run verify -- --service orders` scopes contract tests to that service but
keeps architecture and dependency checks repo-wide. `pnpm run code_review`
performs final lint and validation. Use `/code-review` to prepare the commit
summary; neither command creates the commit.

## Add a New Microservice

1. Copy `libs/users/` as a template into `libs/<new-service>/`.
2. Update `<new-service>/microservice.json`.
3. Add its HTTP contract at `libs/<new-service>/specs/openapi.yaml` and its persistent behavioral capabilities under `openspec/specs/<new-service>/<capability>/`.
4. Reuse global scripts under `scripts/` (no custom per-service scripts required).
5. Register the module in `apps/api/src/app.module.ts`.
6. Discovered services are included automatically by OpenAPI validation, Prisma and contract test commands.
