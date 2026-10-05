# Project Context: NestJS SDD Microservices Boilerplate

## Purpose

Backend boilerplate for building microservices with Spec Driven Development (SDD).
OpenSpec records behavior requirements and change proposals. Each service's
`libs/<service>/specs/openapi.yaml` is its HTTP contract. No behavior-changing code
is written before the OpenSpec change and affected API contract are reviewed. The
React browser client in `apps/web` is a product surface reviewed through the same
OpenSpec workflow under the `web` namespace, not a microservice. Cross-cutting runtime
capabilities owned by the `apps/api` host are reviewed under the `platform` namespace,
which is also not a microservice.

## Tech stack

- NestJS + TypeScript
- Prisma (infrastructure repositories only)
- Zod (application/infrastructure validation only)
- pnpm workspaces
- Jest (contract and API e2e tests)
- React + Vite browser client (`apps/web`) with TanStack Router/Query, Vitest
  (jsdom) for unit/component tests, and Playwright for browser e2e

## Project structure

Nx monorepo: NestJS app in `apps/`, per-service code in `libs/`.

```
apps/
  api/                  the NestJS host app (main.ts, app.module.ts) — wires all services together
    src/
  api-e2e/              end-to-end tests for apps/api
  web/                  the React browser client (Vite, TanStack Router/Query); a product
                        surface tagged platform:browser with no microservice.json
  web-e2e/              Playwright browser smoke tests for apps/web

libs/
  <service>/            one lib per microservice (discovered via microservice.json)
    specs/
      openapi.yaml             HTTP contract for this service
    domain/             pure business logic — no framework, no Prisma, no Zod
      *.entity.ts
      *.vo.ts
      *.domain-service.ts
    application/        orchestrates domain — use cases and repository interfaces
      *.use-case.ts
      *.repository.ts   interfaces only — implementations live in infrastructure
    infrastructure/     NestJS + Prisma — implements interfaces from application
      *.controller.ts
      *.module.ts
      *.repository.prisma.ts
      prisma/           schema.prisma
    tests/              contract tests
  shared/
    domain/             shared domain primitives (allowed in domain + application)
    validation/         shared Zod schemas (allowed in application + infrastructure)
    api-contracts/      reserved for OpenAPI-generated client/types (future frontend)

architecture/           validation engine and rules
scripts/                workflow CLI (not per-service)
.agents/                canonical agent instruction files (tool-agnostic)
docs/                   architecture and workflow documentation
openspec/               shared OpenSpec root; requirements are namespaced per capability owner
  specs/<namespace>/<capability>/spec.md
  changes/               proposals in progress and archived changes
```

A service is discovered automatically if it has a `microservice.json` file. The
`web` namespace is the exception: it identifies the browser client, not a
discovered service, and `apps/web` must stay out of service discovery, Prisma,
contract-test, and OpenAPI validation flows.

The `platform` namespace is the cross-cutting runtime exception: it owns behavior
of the `apps/api` host that spans its modules (for example request correlation and
structured logging) and it is not a microservice. It has no
`libs/platform/microservice.json` and no OpenAPI contract, so it stays out of
service discovery, Prisma, contract-test, and service-scoped OpenAPI validation.
Do not run `pnpm run verify -- --service platform` or
`pnpm run validate:openapi -- --service platform`; a `platform` change is verified
with the repo-wide checks instead.

## Architecture rules (enforced by validation scripts)

Dependency direction — imports must only flow inward:

```
infrastructure → application → domain
```

Forbidden imports (hard rules — never violate):

- `domain/` must NOT import: `@nestjs/*`, `@prisma/client`, `zod`
- `application/` must NOT import: `@prisma/client`
- One microservice must NOT import from another microservice's `domain/`

Allowed shared usage:

- `domain/` may use: `libs/shared/domain`
- `application/` may use: `libs/shared/domain`, `libs/shared/validation`
- `infrastructure/` may use: `libs/shared/domain`, `libs/shared/validation`

Controllers must be thin — business logic belongs in use cases, not controllers.
Repository implementations live in `infrastructure/` only; `application/` holds interfaces.

## SDD workflow

Use the official OpenSpec workflows in three gated phases. A proposal is not
implementation authorization; wait for explicit review before applying it.

1. **Draft and validate:** optionally explore, propose the change, review every
   requirement and task, then run `openspec validate <change>`. For each affected
   backend service, also run `pnpm run validate:openapi -- --service <name>`; a
   `web`-only or `platform`-only change has no OpenAPI contract to validate.
2. **Implement and verify:** apply the approved tasks. For each affected backend
   service run `pnpm run verify -- --service <name>`, which includes the
   service-scoped contract tests and the repo-wide architecture, domain purity,
   invariant, and dependency checks. For web changes run `pnpm run verify` plus
   `pnpm web:test`, `pnpm web:build`, and `pnpm web:e2e`. For platform changes run
   the repo-wide `pnpm run verify`, `pnpm lint`, and
   `openspec validate <change>` (never a service-scoped command for `platform`).
   Then use the report-only OpenSpec verify.
3. **Archive and prepare commit:** archive only after all checks pass, review the
   merged `<namespace>/<capability>` specs, then prepare a commit summary. Git
   commit is manual and remains the user's action.

Invocation varies by tool: GitHub Copilot/OpenCode use `/opsx-propose`, Claude
uses `/opsx:propose`; see `docs/sdd-flow.md` for all phase commands.

Related skill: `.agents/skills/nestjs-sdd-api-practices/SKILL.md`

## Prisma commands

There are no per-service Prisma scripts. A single root command discovers every
service with a `microservice.json` and resolves its config at
`libs/<service>/infrastructure/prisma/prisma.config.ts`.

- `pnpm prisma:generate` — generate clients for all discovered services (services without a `prisma.config.ts` are skipped)
- `pnpm prisma:generate -- --service users` — generate a single service's client
- `pnpm prisma:migrate -- --service users -- --name add_status` — run `migrate dev` for one service; `--service` is required and everything after the second `--` is forwarded verbatim to the Prisma CLI

`prisma:generate` runs automatically as a `pre*` hook before the build, start,
test, `verify` and `test:contract` scripts, so a manual call is rarely needed.

## Key conventions

- `microservice.json` — metadata per service (name, version, specVersion, dependencies)
- OpenSpec capabilities use `openspec/specs/<namespace>/<capability>/spec.md`, where
  the namespace is a discovered service, the browser client `web`, or the
  cross-cutting runtime namespace `platform`
- `libs/<service>/specs/openapi.yaml` remains the HTTP contract for that service;
  neither the `web` nor the `platform` namespace has an OpenAPI contract
- Web behavior is verified with `pnpm web:test`, `pnpm web:build`, and `pnpm web:e2e`
- Platform behavior is verified with the repo-wide `pnpm run verify`, `pnpm lint`,
  and `openspec validate <change>`; never with `--service platform` checks

## Database naming and identifier conventions

Physical PostgreSQL identifiers are lowercase snake_case in every service. Rename
migrations must use `ALTER ... RENAME` (never drop/add) so existing rows and
identifiers are preserved; Prisma does not infer renames.

| Object | Convention | Example |
| --- | --- | --- |
| Table | plural lowercase snake_case; service-owned tables may keep a stable prefix | `auth_users`, `user_profiles` |
| Column | lowercase snake_case | `email_verified`, `auth_user_id` |
| Primary key | named `id` | `id` |
| Foreign key column | `<entity>_id` | `user_id`, `auth_user_id` |
| Primary key constraint | `<table>_pkey` | `auth_users_pkey` |
| Unique index | `<table>_<column>_key` | `auth_users_email_key` |
| Non-unique index | `<table>_<column>_idx` | `auth_sessions_user_id_idx` |
| Foreign key constraint | `<table>_<column>_fkey` | `auth_sessions_user_id_fkey` |

The `auth_*` table prefix is an intentional, preserved exception. Casing scope:

- Persistence TypeScript this repo owns (users Prisma fields, hand-written
  persistence row types) uses snake_case.
- Auth Prisma model and field names stay camelCase because they are the Better
  Auth `prismaAdapter` binding; map the physical columns with `@map` instead.
- Public HTTP/OpenAPI DTOs, domain/application code, and Better Auth canonical API
  object names stay camelCase.

Identifier strategy for identifiers shared across service boundaries:

- All environments keep `TEXT` id columns; do not declare a native PostgreSQL
  `uuid` column type without a separate, data-verified migration.
- Newly created auth identities receive UUID-format ids from Better Auth
  (`advanced.database.generateId` returning `crypto.randomUUID()`), stored in the
  existing TEXT columns; no `@default` is added to id fields.
- Existing ids are preserved byte-for-byte and stay valid opaque strings; a
  cross-service reference such as `users.auth_user_id` accepts both legacy random
  strings and new UUID-format strings.
- Converting to the native `uuid` type (cast after verifying every value is
  UUID-shaped, or an explicit old-string to new-uuid remap across auth and users)
  is deferred to a separate change once a data-bearing environment is available.
- Service-local surrogate keys (for example the users profile `id`) stay
  sequential integers.

## What NOT to do

- Do NOT write business logic in controllers
- Do NOT import Prisma or NestJS in `domain/`
- Do NOT import across microservice domain boundaries
- Do NOT treat OpenAPI as a replacement for behavioral requirements or vice versa
- Do NOT place a service's persistent requirements under another service's namespace
- Do NOT treat `apps/web` as a microservice: no `microservice.json`, no Prisma, no OpenAPI, and no service discovery, contract-test, or OpenAPI validation for it
- Do NOT treat `platform` as a discoverable service or OpenAPI target: no `microservice.json`, no OpenAPI contract, and no `--service platform` checks; verify it with repo-wide checks
- Do NOT treat OpenAPI validation as code generation; use `pnpm run validate:openapi`
- Do NOT modify `architecture/rules.json` to silence a validation failure
- Do NOT skip the spec step — for changes that alter a backend HTTP contract, define or update its OpenAPI before implementing
- Do NOT add per-service Prisma scripts to `package.json`; use `pnpm prisma:generate -- --service <name>`
